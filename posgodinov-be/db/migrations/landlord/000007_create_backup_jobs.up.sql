-- Migrasi #000007: Tabel Backup Jobs dan Backup Files untuk Landlord Backup Management
CREATE TABLE IF NOT EXISTS backup_jobs (
    id VARCHAR(36) PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL,
    target_id VARCHAR(50),
    mode VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_dbs INT NOT NULL DEFAULT 0,
    completed_dbs INT NOT NULL DEFAULT 0,
    total_size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_provider VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    error_message TEXT,
    triggered_by VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_files (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    db_name VARCHAR(100) NOT NULL,
    scope VARCHAR(20) NOT NULL,
    table_name VARCHAR(100),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    storage_provider VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    remote_file_id VARCHAR(255),
    remote_web_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_created_at ON backup_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_files_db_name ON backup_files(db_name);
CREATE INDEX IF NOT EXISTS idx_backup_files_job_id ON backup_files(job_id);
