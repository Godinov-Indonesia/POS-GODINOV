package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"posgodinov-backend/internal/domain"
	"posgodinov-backend/pkg/logger"
	"posgodinov-backend/pkg/response"
)

type BusinessHandler struct {
	svc domain.BusinessService
}

func NewBusinessHandler(svc domain.BusinessService) *BusinessHandler {
	return &BusinessHandler{svc: svc}
}

// generateOAuthState membuat random hex string 16 byte sebagai CSRF state param.
func generateOAuthState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (h *BusinessHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req domain.RegisterBusinessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("gagal membaca request body", "error", err)
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	res, err := h.svc.Register(r.Context(), &req)
	if err != nil {
		logger.Error("gagal mendaftarkan bisnis", "error", err)
		
		errs := make(map[string]string)
		if strings.Contains(err.Error(), "password") {
			errs["password"] = err.Error()
		} else {
			errs["server"] = err.Error()
		}

		response.Error(w, http.StatusBadRequest, "Gagal mendaftarkan bisnis", errs)
		return
	}

	logger.Info("bisnis berhasil didaftarkan", "id", res.Business.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(res)
}

func (h *BusinessHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req domain.LoginBusinessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("gagal membaca request body", "error", err)
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	res, err := h.svc.Login(r.Context(), &req)
	if err != nil {
		logger.Error("gagal login bisnis", "error", err)
		response.Error(w, http.StatusUnauthorized, "Gagal login", map[string]string{"credentials": err.Error()})
		return
	}

	logger.Info("bisnis berhasil login", "id", res.Business.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

func (h *BusinessHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req domain.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("gagal membaca request body", "error", err)
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	res, err := h.svc.RefreshToken(r.Context(), &req)
	if err != nil {
		logger.Error("gagal melakukan refresh token", "error", err)
		errs := make(map[string]string)
		errs["token"] = err.Error()
		response.Error(w, http.StatusUnauthorized, "Gagal memperbarui token", errs)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(res)
}

func (h *BusinessHandler) GoogleOAuthRedirect(w http.ResponseWriter, r *http.Request) {
	state, err := generateOAuthState()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Gagal memulai OAuth", nil)
		return
	}

	// State disimpan di HttpOnly cookie — validasi di callback untuk mencegah CSRF.
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		MaxAge:   300,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})

	http.Redirect(w, r, h.svc.GoogleOAuthURL(r.Context(), state), http.StatusFound)
}

func (h *BusinessHandler) GoogleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "State OAuth tidak ditemukan", nil)
		return
	}

	// Hapus state cookie setelah dibaca — single-use.
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    "",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})

	if r.URL.Query().Get("state") != stateCookie.Value {
		response.Error(w, http.StatusBadRequest, "State OAuth tidak valid", nil)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		response.Error(w, http.StatusBadRequest, "Kode OAuth tidak ditemukan", nil)
		return
	}

	res, err := h.svc.GoogleOAuthCallback(r.Context(), code, stateCookie.Value)
	if err != nil {
		logger.Error("gagal callback Google OAuth", "error", err)
		response.Error(w, http.StatusInternalServerError, "Gagal login dengan Google", map[string]string{"server": err.Error()})
		return
	}

	logger.Info("bisnis berhasil login via Google", "id", res.Business.ID)

	// Encode business sebagai JSON lalu URL-encode untuk query param.
	bizJSON, _ := json.Marshal(res.Business)
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	redirectTarget := fmt.Sprintf(
		"%s/oauth/callback?access_token=%s&refresh_token=%s&business=%s",
		frontendURL,
		res.AccessToken,
		res.RefreshToken,
		url.QueryEscape(string(bizJSON)),
	)
	http.Redirect(w, r, redirectTarget, http.StatusFound)
}

func (h *BusinessHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req domain.ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	// Selalu jawab 200 agar tidak bisa enumerate email.
	_ = h.svc.ForgotPassword(r.Context(), &req)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Jika email terdaftar, instruksi reset password telah dikirim.",
	})
}

func (h *BusinessHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req domain.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Format permintaan tidak valid", nil)
		return
	}

	if err := h.svc.ResetPassword(r.Context(), &req); err != nil {
		response.Error(w, http.StatusBadRequest, err.Error(), map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Password berhasil diperbarui. Silakan login kembali.",
	})
}
