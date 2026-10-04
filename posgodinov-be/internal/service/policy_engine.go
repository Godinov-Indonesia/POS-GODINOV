package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"posgodinov-backend/internal/domain"
)

type cachedPolicy struct {
	policy    *domain.EffectivePolicy
	expiresAt time.Time
}

type policyEngine struct {
	saasRepo domain.SaaSRepository
	cache    sync.Map // key: businessID (string) -> cachedPolicy
	cacheTTL time.Duration
}

func NewPolicyEngine(saasRepo domain.SaaSRepository) domain.PolicyEngine {
	return &policyEngine{
		saasRepo: saasRepo,
		cacheTTL: 5 * time.Minute,
	}
}

func (pe *policyEngine) GetEffectivePolicy(ctx context.Context, businessID string) (*domain.EffectivePolicy, error) {
	if cachedVal, ok := pe.cache.Load(businessID); ok {
		item := cachedVal.(cachedPolicy)
		if time.Now().Before(item.expiresAt) {
			return item.policy, nil
		}
		pe.cache.Delete(businessID)
	}

	sub, err := pe.saasRepo.GetSubscriptionByBusinessID(ctx, businessID)
	if err != nil {
		// Fallback ke plan_free jika tenant belum memiliki record langganan
		plan, pErr := pe.saasRepo.GetPlanByID(ctx, "plan_free")
		if pErr != nil {
			return nil, fmt.Errorf("gagal memuat paket default: %w", pErr)
		}
		sub = &domain.Subscription{
			BusinessID: businessID,
			PlanID:     plan.ID,
			Plan:       plan,
			Status:     "ACTIVE",
		}
	}

	numericLimits := make(map[string]int64)
	booleanFlags := make(map[string]bool)

	// 1. Ambil aturan dasar paket
	if sub.Plan != nil {
		for _, pf := range sub.Plan.Features {
			numericLimits[pf.FeatureKey] = pf.LimitValue
			booleanFlags[pf.FeatureKey] = pf.IsEnabled
		}
	}

	// 2. Terapkan tenant overrides yang masih aktif
	overrides, err := pe.saasRepo.ListActiveOverrides(ctx, businessID)
	if err == nil {
		for _, ov := range overrides {
			switch ov.OverrideType {
			case "ADD_LIMIT":
				if ov.ValueNumeric != nil {
					cur := numericLimits[ov.FeatureKey]
					if cur != -1 { // jika belum unlimited
						numericLimits[ov.FeatureKey] = cur + *ov.ValueNumeric
					}
				}
			case "SET_LIMIT":
				if ov.ValueNumeric != nil {
					numericLimits[ov.FeatureKey] = *ov.ValueNumeric
				}
			case "ENABLE_FLAG":
				booleanFlags[ov.FeatureKey] = true
			case "DISABLE_FLAG":
				booleanFlags[ov.FeatureKey] = false
			}
		}
	}

	planCode := "FREE"
	planName := "Free Tier"
	if sub.Plan != nil {
		planCode = sub.Plan.Code
		planName = sub.Plan.Name
	}

	policy := &domain.EffectivePolicy{
		PlanCode:     planCode,
		PlanName:     planName,
		Status:       sub.Status,
		NumericLimit: numericLimits,
		BooleanFlags: booleanFlags,
		CachedAt:     time.Now(),
	}

	pe.cache.Store(businessID, cachedPolicy{
		policy:    policy,
		expiresAt: time.Now().Add(pe.cacheTTL),
	})

	return policy, nil
}

type QuotaExceededError struct {
	FeatureKey   string
	CurrentUsage int64
	LimitValue   int64
}

func (e *QuotaExceededError) Error() string {
	return fmt.Sprintf("Batas kuota '%s' tercapai (penggunaan: %d, batas: %d)", e.FeatureKey, e.CurrentUsage, e.LimitValue)
}

func (pe *policyEngine) AssertQuota(ctx context.Context, businessID, featureKey string, currentUsage int64) error {
	policy, err := pe.GetEffectivePolicy(ctx, businessID)
	if err != nil {
		return err
	}

	limit, exists := policy.NumericLimit[featureKey]
	if !exists {
		return nil
	}

	// -1 menandakan tidak terbatas (unlimited)
	if limit == -1 {
		return nil
	}

	if currentUsage > limit {
		return &QuotaExceededError{
			FeatureKey:   featureKey,
			CurrentUsage: currentUsage,
			LimitValue:   limit,
		}
	}

	return nil
}

func (pe *policyEngine) AssertFeature(ctx context.Context, businessID, featureKey string) error {
	policy, err := pe.GetEffectivePolicy(ctx, businessID)
	if err != nil {
		return err
	}

	enabled, exists := policy.BooleanFlags[featureKey]
	if !exists || !enabled {
		return errors.New("fitur ini tidak tersedia pada paket Anda, silakan tingkatkan ke Pro")
	}

	return nil
}

func (pe *policyEngine) GetNumericLimit(ctx context.Context, businessID, featureKey string) (int64, error) {
	policy, err := pe.GetEffectivePolicy(ctx, businessID)
	if err != nil {
		return 0, err
	}
	limit, exists := policy.NumericLimit[featureKey]
	if !exists {
		return -1, nil
	}
	return limit, nil
}

func (pe *policyEngine) InvalidateCache(businessID string) {
	if businessID == "" {
		// Kosongkan seluruh cache jika parameter kosong (misal saat matriks global di-update)
		pe.cache.Range(func(key, value any) bool {
			pe.cache.Delete(key)
			return true
		})
		return
	}
	pe.cache.Delete(businessID)
}
