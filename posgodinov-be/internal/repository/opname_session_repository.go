package repository

import (
	"context"
	"errors"
	"time"

	"posgodinov-backend/internal/database"
	"posgodinov-backend/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type opnameSessionRepository struct {
	db *gorm.DB
}

// NewOpnameSessionRepository membuat instance repository baru.
func NewOpnameSessionRepository(db *gorm.DB) domain.OpnameSessionRepository {
	return &opnameSessionRepository{db: db}
}

func (r *opnameSessionRepository) Create(ctx context.Context, session *domain.OpnameSession) error {
	db := database.GetDB(ctx, r.db)
	err := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(session).Error
	return err
}

func (r *opnameSessionRepository) GetByID(ctx context.Context, id string) (*domain.OpnameSession, error) {
	db := database.GetDB(ctx, r.db)
	var session domain.OpnameSession
	err := db.WithContext(ctx).Where("id = ?", id).First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("sesi opname tidak ditemukan")
		}
		return nil, err
	}
	return &session, nil
}

func (r *opnameSessionRepository) ListByOutlet(ctx context.Context, outletID string, statuses []string, limit, offset int) ([]*domain.OpnameSession, error) {
	db := database.GetDB(ctx, r.db)
	query := db.WithContext(ctx).Where("outlet_id = ?", outletID)
	if len(statuses) > 0 {
		query = query.Where("status IN ?", statuses)
	}
	var sessions []*domain.OpnameSession
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&sessions).Error
	return sessions, err
}

func (r *opnameSessionRepository) SetFormItems(ctx context.Context, sessionID string, rawMaterialIDs []string) error {
	db := database.GetDB(ctx, r.db)
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("session_id = ?", sessionID).Delete(&domain.OpnameFormItem{}).Error; err != nil {
			return err
		}
		if len(rawMaterialIDs) == 0 {
			return nil
		}
		
		for _, rmID := range rawMaterialIDs {
			err := tx.Exec("INSERT INTO opname_form_items (id, session_id, raw_material_id) VALUES (gen_random_uuid(), ?, ?)", sessionID, rmID).Error
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *opnameSessionRepository) ListFormItems(ctx context.Context, sessionID string) ([]*domain.OpnameFormItem, error) {
	db := database.GetDB(ctx, r.db)
	var items []*domain.OpnameFormItem
	err := db.WithContext(ctx).Where("session_id = ?", sessionID).Find(&items).Error
	return items, err
}

func (r *opnameSessionRepository) UpsertCountEntries(ctx context.Context, entries []*domain.OpnameCountEntry) error {
	db := database.GetDB(ctx, r.db)
	err := db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "session_id"},
			{Name: "raw_material_id"},
			{Name: "counted_by"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"actual_packages",
			"actual_loose",
			"actual_stock",
			"notes",
			"updated_at",
		}),
	}).Create(&entries).Error
	return err
}

func (r *opnameSessionRepository) ListCountEntries(ctx context.Context, sessionID string) ([]*domain.OpnameCountEntry, error) {
	db := database.GetDB(ctx, r.db)
	var entries []*domain.OpnameCountEntry
	err := db.WithContext(ctx).Where("session_id = ?", sessionID).Find(&entries).Error
	return entries, err
}

func (r *opnameSessionRepository) ListCountEntriesByStaff(ctx context.Context, sessionID, staffID string) ([]*domain.OpnameCountEntry, error) {
	db := database.GetDB(ctx, r.db)
	var entries []*domain.OpnameCountEntry
	err := db.WithContext(ctx).Where("session_id = ? AND counted_by = ?", sessionID, staffID).Find(&entries).Error
	return entries, err
}

func (r *opnameSessionRepository) HasCountEntries(ctx context.Context, sessionID string) (bool, error) {
	db := database.GetDB(ctx, r.db)
	var exists bool
	err := db.WithContext(ctx).Raw("SELECT EXISTS(SELECT 1 FROM opname_count_entries WHERE session_id = ?)", sessionID).Scan(&exists).Error
	return exists, err
}

func (r *opnameSessionRepository) ListItems(ctx context.Context, sessionID string) ([]*domain.OpnameSessionItem, error) {
	db := database.GetDB(ctx, r.db)
	var items []*domain.OpnameSessionItem
	err := db.WithContext(ctx).Where("session_id = ?", sessionID).Find(&items).Error
	return items, err
}

func (r *opnameSessionRepository) Publish(ctx context.Context, sessionID string, publishedAt time.Time) error {
	db := database.GetDB(ctx, r.db)
	res := db.WithContext(ctx).Model(&domain.OpnameSession{}).
		Where("id = ? AND status = ?", sessionID, domain.SOStatusOpen).
		Updates(map[string]interface{}{
			"status":       domain.SOStatusPublished,
			"published_at": publishedAt,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("sesi opname tidak dapat dipublish (mungkin status bukan OPEN)")
	}
	return nil
}

func (r *opnameSessionRepository) MarkCounting(ctx context.Context, sessionID string) error {
	db := database.GetDB(ctx, r.db)
	res := db.WithContext(ctx).Model(&domain.OpnameSession{}).
		Where("id = ? AND status = ?", sessionID, domain.SOStatusPublished).
		Update("status", domain.SOStatusCounting)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("sesi opname gagal ditandai COUNTING (mungkin sudah COUNTING atau bukan PUBLISHED)")
	}
	return nil
}

func (r *opnameSessionRepository) Close(ctx context.Context, sessionID string, closedAt time.Time, closedBy string) error {
	db := database.GetDB(ctx, r.db)
	
	// a. Aggregate count_entries into session_items
	aggregateQuery := `
    INSERT INTO opname_session_items (id, session_id, raw_material_id, actual_packages, actual_loose, actual_stock)
    SELECT gen_random_uuid(), ce.session_id, ce.raw_material_id,
           SUM(ce.actual_packages),
           SUM(ce.actual_loose),
           SUM(ce.actual_stock)
    FROM opname_count_entries ce WHERE ce.session_id = ?
    GROUP BY ce.session_id, ce.raw_material_id
    ON CONFLICT (session_id, raw_material_id) DO UPDATE SET
        actual_packages = EXCLUDED.actual_packages,
        actual_loose = EXCLUDED.actual_loose,
        actual_stock = EXCLUDED.actual_stock;`
	if err := db.WithContext(ctx).Exec(aggregateQuery, sessionID).Error; err != nil {
		return err
	}
	
	// b. Lock raw materials
	lockQuery := `
	SELECT id FROM raw_materials 
	WHERE id IN (SELECT raw_material_id FROM opname_session_items WHERE session_id = ?) 
	ORDER BY id FOR UPDATE`
	if err := db.WithContext(ctx).Exec(lockQuery, sessionID).Error; err != nil {
		return err
	}
	
	// c. Snapshot system_stock + compute diff + fraud_flag
	snapshotQuery := `
    UPDATE opname_session_items i SET
        system_stock = rm.unit_stock,
        system_package_stock = rm.package_stock,
        system_loose_stock = rm.loose_stock,
        difference = i.actual_stock - rm.unit_stock,
        difference_value = (i.actual_stock - rm.unit_stock) * rm.cost_per_unit,
        fraud_flag = CASE WHEN rm.unit_stock = 0 THEN i.actual_stock <> 0 ELSE abs(i.actual_stock - rm.unit_stock) / abs(rm.unit_stock) > ? OR abs((i.actual_stock - rm.unit_stock) * rm.cost_per_unit) > ? END
    FROM raw_materials rm
    WHERE i.raw_material_id = rm.id AND i.session_id = ?;`
	if err := db.WithContext(ctx).Exec(snapshotQuery, domain.OpnameFraudRatio, domain.OpnameFraudThreshold, sessionID).Error; err != nil {
		return err
	}
	
	// d. Update status COUNTING→CLOSED
	res := db.WithContext(ctx).Model(&domain.OpnameSession{}).
		Where("id = ? AND status = ?", sessionID, domain.SOStatusCounting).
		Updates(map[string]interface{}{
			"status":    domain.SOStatusClosed,
			"closed_at": closedAt,
			"closed_by": closedBy,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("sesi opname tidak dapat ditutup (status bukan COUNTING)")
	}
	
	return nil
}

func (r *opnameSessionRepository) Approve(ctx context.Context, sessionID string, approvedBy string, approvedAt time.Time) error {
	db := database.GetDB(ctx, r.db)
	res := db.WithContext(ctx).Model(&domain.OpnameSession{}).
		Where("id = ? AND status = ?", sessionID, domain.SOStatusClosed).
		Updates(map[string]interface{}{
			"status":      domain.SOStatusApproved,
			"approved_by": approvedBy,
			"approved_at": approvedAt,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("sesi opname tidak dapat disetujui (status bukan CLOSED)")
	}
	return nil
}

func (r *opnameSessionRepository) Reject(ctx context.Context, sessionID string, rejectedBy string, rejectedAt time.Time) error {
	db := database.GetDB(ctx, r.db)
	res := db.WithContext(ctx).Model(&domain.OpnameSession{}).
		Where("id = ? AND status = ?", sessionID, domain.SOStatusClosed).
		Updates(map[string]interface{}{
			"status":      domain.SOStatusRejected,
			"approved_by": rejectedBy,
			"approved_at": rejectedAt,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("sesi opname tidak dapat ditolak (status bukan CLOSED)")
	}
	return nil
}

func (r *opnameSessionRepository) GetRecountChain(ctx context.Context, sessionID string) ([]*domain.OpnameSession, error) {
	db := database.GetDB(ctx, r.db)
	
	combinedQuery := `
    WITH RECURSIVE ancestors AS (
        SELECT * FROM opname_sessions WHERE id = ?
        UNION
        SELECT s.* FROM opname_sessions s JOIN ancestors a ON s.id = a.recount_of
    ),
    descendants AS (
        SELECT * FROM opname_sessions WHERE id = ?
        UNION
        SELECT s.* FROM opname_sessions s JOIN descendants d ON s.recount_of = d.id
    )
    SELECT * FROM (
        SELECT * FROM ancestors
        UNION
        SELECT * FROM descendants
    ) combined
    ORDER BY recount_number;`
	
	var sessions []*domain.OpnameSession
	err := db.WithContext(ctx).Raw(combinedQuery, sessionID, sessionID).Scan(&sessions).Error
	return sessions, err
}
