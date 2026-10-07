package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"
)

type dunningService struct {
	saasRepo     domain.SaaSRepository
	policyEngine domain.PolicyEngine
	txManager    database.TransactionManager
}

type DunningOption func(*dunningService)

func WithDunningTxManager(tm database.TransactionManager) DunningOption {
	return func(s *dunningService) {
		s.txManager = tm
	}
}

func (s *dunningService) withTx(ctx context.Context, fn func(ctx context.Context) error) error {
	if s.txManager != nil {
		return s.txManager.WithTransaction(ctx, fn)
	}
	return fn(ctx)
}

// NewDunningService membuat instans baru DunningService
func NewDunningService(saasRepo domain.SaaSRepository, policyEngine domain.PolicyEngine, opts ...DunningOption) domain.DunningService {
	s := &dunningService{
		saasRepo:     saasRepo,
		policyEngine: policyEngine,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// RunDunningCheck memeriksa subscription yang kedaluwarsa dan menangani masa tenggang / downgrade otomatis
func (s *dunningService) RunDunningCheck(ctx context.Context) error {
	now := time.Now()

	// 1. Subscription ACTIVE yang expires_at <= NOW() -> ubah ke PAST_DUE (Grace Period)
	activeExpired, err := s.saasRepo.ListSubscriptionsExpiredBefore(ctx, now, "ACTIVE")
	if err != nil {
		return fmt.Errorf("gagal mengambil data subscription aktif kedaluwarsa: %w", err)
	}

	for _, sub := range activeExpired {
		err := s.withTx(ctx, func(txCtx context.Context) error {
			sub.Status = "PAST_DUE"
			sub.UpdatedAt = now
			if err := s.saasRepo.UpdateSubscription(txCtx, sub); err != nil {
				return err
			}

			return s.saasRepo.CreateSubscriptionLog(txCtx, &domain.SubscriptionLog{
				ID:             uuid.New().String(),
				SubscriptionID: sub.ID,
				BusinessID:     sub.BusinessID,
				Event:          "STATUS_CHANGED",
				FromPlanID:     &sub.PlanID,
				ToPlanID:       sub.PlanID,
				Remarks:        "Subscription expired, entered grace period (PAST_DUE)",
				CreatedAt:      now,
			})
		})
		if err != nil {
			log.Printf("[dunning] gagal update status PAST_DUE untuk subscription %s: %v", sub.ID, err)
			continue
		}

		s.policyEngine.InvalidateCache(sub.BusinessID)
	}

	// 2. Subscription PAST_DUE yang expires_at <= NOW() - 7 hari -> ubah ke EXPIRED & downgrade ke FREE
	graceThreshold := now.AddDate(0, 0, -7)
	pastDueExpired, err := s.saasRepo.ListSubscriptionsExpiredBefore(ctx, graceThreshold, "PAST_DUE")
	if err != nil {
		return fmt.Errorf("gagal mengambil data subscription past_due habis masa tenggang: %w", err)
	}

	freePlanID := "plan_free"
	freePlan, err := s.saasRepo.GetPlanByCode(ctx, "FREE")
	if err == nil && freePlan != nil {
		freePlanID = freePlan.ID
	}

	for _, sub := range pastDueExpired {
		oldPlanID := sub.PlanID
		err := s.withTx(ctx, func(txCtx context.Context) error {
			sub.Status = "EXPIRED"
			sub.PlanID = freePlanID
			sub.ExpiresAt = nil // Free tier bersifat lifetime
			sub.UpdatedAt = now

			if err := s.saasRepo.UpdateSubscription(txCtx, sub); err != nil {
				return err
			}

			return s.saasRepo.CreateSubscriptionLog(txCtx, &domain.SubscriptionLog{
				ID:             uuid.New().String(),
				SubscriptionID: sub.ID,
				BusinessID:     sub.BusinessID,
				Event:          "DOWNGRADED",
				FromPlanID:     &oldPlanID,
				ToPlanID:       freePlanID,
				Remarks:        "Grace period 7 hari berakhir, otomatis downgrade ke Free Tier",
				CreatedAt:      now,
			})
		})
		if err != nil {
			log.Printf("[dunning] gagal downgrade subscription %s: %v", sub.ID, err)
			continue
		}

		s.policyEngine.InvalidateCache(sub.BusinessID)
	}

	return nil
}
