package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/internal/middleware"
	"posgodinov-backend/internal/service"
	"posgodinov-backend/pkg/response"
	"posgodinov-backend/pkg/token"
)

type LandlordHandler struct {
	svc service.LandlordService
}

func NewLandlordHandler(svc service.LandlordService) *LandlordHandler {
	return &LandlordHandler{svc: svc}
}

func (h *LandlordHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req domain.LandlordLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid", nil)
		return
	}

	res, err := h.svc.Login(r.Context(), &req)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Login landlord berhasil", res)
}

func (h *LandlordHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	user, err := h.svc.GetMe(r.Context(), payload.ID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Pengguna tidak ditemukan", nil)
		return
	}

	response.Success(w, http.StatusOK, "Profil landlord berhasil diambil", user)
}

func (h *LandlordHandler) Impersonate(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	businessID := r.PathValue("id")
	if businessID == "" {
		response.Error(w, http.StatusBadRequest, "ID bisnis diperlukan", nil)
		return
	}

	res, err := h.svc.Impersonate(r.Context(), payload.ID, businessID)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error(), nil)
		return
	}

	response.Success(w, http.StatusOK, "Sesi impersonasi berhasil dibuat (30 menit)", res)
}

func (h *LandlordHandler) ListFeatures(w http.ResponseWriter, r *http.Request) {
	features, err := h.svc.ListFeatures(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil daftar fitur", nil)
		return
	}
	response.Success(w, http.StatusOK, "Daftar fitur berhasil diambil", features)
}

func (h *LandlordHandler) ListPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := h.svc.ListPlans(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil daftar paket", nil)
		return
	}
	response.Success(w, http.StatusOK, "Daftar paket berhasil diambil", plans)
}

type updatePlanFeatureReq struct {
	IsEnabled   bool         `json:"is_enabled"`
	LimitValue  int64        `json:"limit_value"`
	ExtraConfig domain.JSONB `json:"extra_config"`
}

func (h *LandlordHandler) UpdatePlanFeature(w http.ResponseWriter, r *http.Request) {
	payload, _ := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	planID := r.PathValue("id")
	featureKey := r.PathValue("feature_key")

	var req updatePlanFeatureReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid", nil)
		return
	}

	if err := h.svc.UpdatePlanFeature(r.Context(), payload.ID, planID, featureKey, req.IsEnabled, req.LimitValue, req.ExtraConfig); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal memperbarui aturan fitur paket", nil)
		return
	}

	response.Success(w, http.StatusOK, "Aturan fitur paket berhasil diperbarui", nil)
}

func (h *LandlordHandler) ListOverrides(w http.ResponseWriter, r *http.Request) {
	businessID := r.PathValue("id")
	overrides, err := h.svc.ListOverrides(r.Context(), businessID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil daftar override", nil)
		return
	}
	response.Success(w, http.StatusOK, "Daftar override berhasil diambil", overrides)
}

func (h *LandlordHandler) CreateOverride(w http.ResponseWriter, r *http.Request) {
	payload, _ := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	businessID := r.PathValue("id")

	var override domain.TenantFeatureOverride
	if err := json.NewDecoder(r.Body).Decode(&override); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid", nil)
		return
	}
	override.BusinessID = businessID

	if err := h.svc.CreateOverride(r.Context(), payload.ID, &override); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal membuat override", nil)
		return
	}

	response.Success(w, http.StatusCreated, "Override berhasil ditambahkan", override)
}

func (h *LandlordHandler) DeleteOverride(w http.ResponseWriter, r *http.Request) {
	payload, _ := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	businessID := r.PathValue("id")
	overrideID := r.PathValue("override_id")

	if err := h.svc.DeleteOverride(r.Context(), payload.ID, overrideID, businessID); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal menghapus override", nil)
		return
	}

	response.Success(w, http.StatusOK, "Override berhasil dihapus", nil)
}

func (h *LandlordHandler) ListCampaigns(w http.ResponseWriter, r *http.Request) {
	targetTier := r.URL.Query().Get("target_tier")
	placement := r.URL.Query().Get("placement")
	campaigns, err := h.svc.ListCampaigns(r.Context(), targetTier, placement)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil kampanye", nil)
		return
	}
	response.Success(w, http.StatusOK, "Daftar kampanye berhasil diambil", campaigns)
}

func (h *LandlordHandler) CreateCampaign(w http.ResponseWriter, r *http.Request) {
	payload, _ := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	var campaign domain.SaaSCampaign
	if err := json.NewDecoder(r.Body).Decode(&campaign); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid", nil)
		return
	}

	if err := h.svc.CreateCampaign(r.Context(), payload.ID, &campaign); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal membuat kampanye", nil)
		return
	}

	response.Success(w, http.StatusCreated, "Kampanye berhasil dibuat", campaign)
}

func (h *LandlordHandler) GetLandingSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.GetLandingSettings(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil pengaturan landing", nil)
		return
	}
	response.Success(w, http.StatusOK, "Pengaturan landing berhasil diambil", settings)
}

type updateSettingReq struct {
	Value       domain.JSONB `json:"value"`
	Description string       `json:"description"`
}

func (h *LandlordHandler) UpdateLandingSetting(w http.ResponseWriter, r *http.Request) {
	payload, _ := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	key := r.PathValue("key")

	var req updateSettingReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Permintaan tidak valid", nil)
		return
	}

	if err := h.svc.UpdateLandingSetting(r.Context(), payload.ID, key, req.Value, req.Description); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal memperbarui pengaturan", nil)
		return
	}

	response.Success(w, http.StatusOK, "Pengaturan berhasil diperbarui", nil)
}

// Public API
func (h *LandlordHandler) GetPublicLandingPage(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetPublicLandingPage(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil data landing page", nil)
		return
	}
	response.Success(w, http.StatusOK, "Data landing page publik berhasil diambil", data)
}

// Merchant APIs
func (h *LandlordHandler) GetTenantSubscription(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	res, err := h.svc.GetTenantSubscription(r.Context(), payload.ID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Langganan tidak ditemukan", nil)
		return
	}

	response.Success(w, http.StatusOK, "Detail langganan berhasil diambil", res)
}

func (h *LandlordHandler) GetTenantCampaigns(w http.ResponseWriter, r *http.Request) {
	payload, ok := r.Context().Value(middleware.AuthPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token tidak valid", nil)
		return
	}

	placement := r.URL.Query().Get("placement")
	campaigns, err := h.svc.GetTenantCampaigns(r.Context(), payload.ID, placement)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mengambil kampanye", nil)
		return
	}

	response.Success(w, http.StatusOK, "Daftar kampanye berhasil diambil", campaigns)
}

func (h *LandlordHandler) RecordCampaignClick(w http.ResponseWriter, r *http.Request) {
	campaignID := r.PathValue("id")
	if campaignID == "" {
		response.Error(w, http.StatusBadRequest, "ID kampanye diperlukan", nil)
		return
	}

	if err := h.svc.RecordCampaignClick(r.Context(), campaignID); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mencatat klik kampanye", nil)
		return
	}

	response.Success(w, http.StatusOK, "Klik kampanye berhasil dicatat", nil)
}

func (h *LandlordHandler) ListBusinesses(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")
	planID := r.URL.Query().Get("plan_id")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	businesses, total, err := h.svc.ListBusinesses(r.Context(), search, status, planID, page, limit)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal memuat direktori bisnis", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Direktori bisnis berhasil dimuat", map[string]any{
		"businesses": businesses,
		"total":      total,
		"page":       page,
		"limit":      limit,
	})
}

func (h *LandlordHandler) GetBusinessDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, "ID bisnis diperlukan", nil)
		return
	}

	detail, err := h.svc.GetBusinessDetail(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Bisnis tidak ditemukan", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Detail bisnis berhasil dimuat", detail)
}

func (h *LandlordHandler) SuspendBusiness(w http.ResponseWriter, r *http.Request) {
	adminPayload, ok := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token landlord tidak valid", nil)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, "ID bisnis diperlukan", nil)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := h.svc.SuspendBusiness(r.Context(), adminPayload.ID, id, req.Reason); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal menangguhkan bisnis", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Bisnis berhasil ditangguhkan (SUSPENDED)", nil)
}

func (h *LandlordHandler) UnsuspendBusiness(w http.ResponseWriter, r *http.Request) {
	adminPayload, ok := r.Context().Value(middleware.LandlordPayloadKey).(*token.Payload)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Token landlord tidak valid", nil)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		response.Error(w, http.StatusBadRequest, "ID bisnis diperlukan", nil)
		return
	}

	if err := h.svc.UnsuspendBusiness(r.Context(), adminPayload.ID, id); err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal mencabut penangguhan bisnis", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Penangguhan bisnis berhasil dicabut", nil)
}

func (h *LandlordHandler) GetMetricsOverview(w http.ResponseWriter, r *http.Request) {
	metrics, err := h.svc.GetMetricsOverview(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal memuat ringkasan metrik", map[string]string{"error": err.Error()})
		return
	}

	response.Success(w, http.StatusOK, "Ringkasan metrik platform berhasil dimuat", metrics)
}
