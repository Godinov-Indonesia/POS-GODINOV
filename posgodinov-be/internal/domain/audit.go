package domain

import (
	"context"
	"time"
)

type AuditLog struct {
	ID         string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ActorID    string    `json:"actor_id" gorm:"column:actor_id"`
	ActorType  string    `json:"actor_type" gorm:"column:actor_type"`
	Action     string    `json:"action" gorm:"column:action"`
	Method     string    `json:"method" gorm:"column:method"`
	Path       string    `json:"path" gorm:"column:path"`
	Details    string    `json:"details" gorm:"column:details;type:jsonb"`
	IPAddress  string    `json:"ip_address" gorm:"column:ip_address"`
	UserAgent  string    `json:"user_agent" gorm:"column:user_agent"`
	StatusCode int       `json:"status_code" gorm:"column:status_code"`
	CreatedAt  time.Time `json:"created_at,omitzero" gorm:"column:created_at"`
}

type AuditRepository interface {
	Create(ctx context.Context, log *AuditLog) error
}
