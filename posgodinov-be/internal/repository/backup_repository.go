package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
	"posgodinov-backend/internal/domain"
)

type backupRepository struct {
	db *gorm.DB
}

func NewBackupRepository(db *gorm.DB) domain.BackupRepository {
	return &backupRepository{db: db}
}

func (r *backupRepository) CreateJob(ctx context.Context, job *domain.BackupJob) error {
	return r.db.WithContext(ctx).Create(job).Error
}

func (r *backupRepository) GetJobByID(ctx context.Context, id string) (*domain.BackupJob, error) {
	var job domain.BackupJob
	if err := r.db.WithContext(ctx).Preload("Files").Where("id = ?", id).First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *backupRepository) ListJobs(ctx context.Context, limit, offset int) ([]*domain.BackupJob, int64, error) {
	var jobs []*domain.BackupJob
	var total int64

	q := r.db.WithContext(ctx).Model(&domain.BackupJob{})
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&jobs).Error; err != nil {
		return nil, 0, err
	}

	return jobs, total, nil
}

func (r *backupRepository) UpdateJobProgress(ctx context.Context, id string, completedDBs int, totalSize int64, status domain.BackupStatus, errMsg *string, completedAt *time.Time) error {
	updates := map[string]interface{}{
		"completed_dbs":    completedDBs,
		"total_size_bytes": totalSize,
		"status":           status,
	}
	if errMsg != nil {
		updates["error_message"] = *errMsg
	}
	if completedAt != nil {
		updates["completed_at"] = *completedAt
	}

	return r.db.WithContext(ctx).Model(&domain.BackupJob{}).Where("id = ?", id).Updates(updates).Error
}

func (r *backupRepository) AddFile(ctx context.Context, file *domain.BackupFile) error {
	return r.db.WithContext(ctx).Create(file).Error
}

func (r *backupRepository) GetFileByID(ctx context.Context, id string) (*domain.BackupFile, error) {
	var file domain.BackupFile
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *backupRepository) ListFiles(ctx context.Context, filter domain.BackupFileFilter) ([]*domain.BackupFile, int64, error) {
	var files []*domain.BackupFile
	var total int64

	q := r.db.WithContext(ctx).Model(&domain.BackupFile{})
	if filter.DBName != "" {
		q = q.Where("db_name = ?", filter.DBName)
	}
	if filter.Scope != "" {
		q = q.Where("scope = ?", filter.Scope)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := 0
	if filter.Page > 1 {
		offset = (filter.Page - 1) * limit
	}

	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&files).Error; err != nil {
		return nil, 0, err
	}

	return files, total, nil
}

func (r *backupRepository) DeleteFile(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&domain.BackupFile{}).Error
}
