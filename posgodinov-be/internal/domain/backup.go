package domain

import (
	"context"
	"io"
	"time"
)

type BackupTargetType string

const (
	BackupTargetAll      BackupTargetType = "ALL"
	BackupTargetLandlord BackupTargetType = "LANDLORD"
	BackupTargetTenant   BackupTargetType = "TENANT"
)

type BackupMode string

const (
	BackupModeFull          BackupMode = "FULL"
	BackupModeTables        BackupMode = "TABLES"
	BackupModeFullAndTables BackupMode = "FULL_AND_TABLES"
)

type BackupStatus string

const (
	BackupStatusPending    BackupStatus = "PENDING"
	BackupStatusInProgress BackupStatus = "IN_PROGRESS"
	BackupStatusCompleted  BackupStatus = "COMPLETED"
	BackupStatusFailed     BackupStatus = "FAILED"
)

type BackupScope string

const (
	BackupScopeFull  BackupScope = "FULL"
	BackupScopeTable BackupScope = "TABLE"
)

type BackupJob struct {
	ID              string           `json:"id" gorm:"primaryKey;column:id"`
	TargetType      BackupTargetType `json:"target_type" gorm:"column:target_type"`
	TargetID        *string          `json:"target_id,omitempty" gorm:"column:target_id"`
	Mode            BackupMode       `json:"mode" gorm:"column:mode"`
	Status          BackupStatus     `json:"status" gorm:"column:status"`
	TotalDBs        int              `json:"total_dbs" gorm:"column:total_dbs"`
	CompletedDBs    int              `json:"completed_dbs" gorm:"column:completed_dbs"`
	TotalSizeBytes  int64            `json:"total_size_bytes" gorm:"column:total_size_bytes"`
	StorageProvider string           `json:"storage_provider" gorm:"column:storage_provider"`
	ErrorMessage    *string          `json:"error_message,omitempty" gorm:"column:error_message"`
	TriggeredBy     string           `json:"triggered_by" gorm:"column:triggered_by"`
	StartedAt       *time.Time       `json:"started_at,omitempty" gorm:"column:started_at"`
	CompletedAt     *time.Time       `json:"completed_at,omitempty" gorm:"column:completed_at"`
	CreatedAt       time.Time        `json:"created_at" gorm:"column:created_at"`
	Files           []BackupFile     `json:"files,omitempty" gorm:"foreignKey:JobID"`
}

func (BackupJob) TableName() string { return "backup_jobs" }

type BackupFile struct {
	ID              string      `json:"id" gorm:"primaryKey;column:id"`
	JobID           string      `json:"job_id" gorm:"column:job_id"`
	DBName          string      `json:"db_name" gorm:"column:db_name"`
	Scope           BackupScope `json:"scope" gorm:"column:scope"`
	TableNameColumn *string     `json:"table_name,omitempty" gorm:"column:table_name"`
	FilePath        string      `json:"file_path" gorm:"column:file_path"`
	FileSizeBytes   int64       `json:"file_size_bytes" gorm:"column:file_size_bytes"`
	ChecksumSHA256  string      `json:"checksum_sha256" gorm:"column:checksum_sha256"`
	StorageProvider string      `json:"storage_provider" gorm:"column:storage_provider"`
	RemoteFileID    *string     `json:"remote_file_id,omitempty" gorm:"column:remote_file_id"`
	RemoteWebLink   *string     `json:"remote_web_link,omitempty" gorm:"column:remote_web_link"`
	CreatedAt       time.Time   `json:"created_at" gorm:"column:created_at"`
}

func (BackupFile) TableName() string { return "backup_files" }

type TriggerBackupRequest struct {
	Target          BackupTargetType `json:"target"`
	TenantID        string           `json:"tenant_id,omitempty"`
	Mode            BackupMode       `json:"mode,omitempty"`
	StorageProvider string           `json:"storage_provider,omitempty"` // LOCAL, GDRIVE, BOTH
	Tables          []string         `json:"tables,omitempty"`
}

type BackupFileFilter struct {
	DBName string
	Scope  string
	Page   int
	Limit  int
}

type BackupRepository interface {
	CreateJob(ctx context.Context, job *BackupJob) error
	GetJobByID(ctx context.Context, id string) (*BackupJob, error)
	ListJobs(ctx context.Context, limit, offset int) ([]*BackupJob, int64, error)
	UpdateJobProgress(ctx context.Context, id string, completedDBs int, totalSize int64, status BackupStatus, errMsg *string, completedAt *time.Time) error
	AddFile(ctx context.Context, file *BackupFile) error
	GetFileByID(ctx context.Context, id string) (*BackupFile, error)
	ListFiles(ctx context.Context, filter BackupFileFilter) ([]*BackupFile, int64, error)
	DeleteFile(ctx context.Context, id string) error
}

type BackupService interface {
	TriggerBackup(ctx context.Context, triggeredBy string, req *TriggerBackupRequest) (*BackupJob, error)
	GetJob(ctx context.Context, id string) (*BackupJob, error)
	ListJobs(ctx context.Context, page, limit int) ([]*BackupJob, int64, error)
	ListFiles(ctx context.Context, filter BackupFileFilter) ([]*BackupFile, int64, error)
	GetFileForDownload(ctx context.Context, id string) (*BackupFile, io.ReadCloser, error)
	DeleteFile(ctx context.Context, id string) error
}
