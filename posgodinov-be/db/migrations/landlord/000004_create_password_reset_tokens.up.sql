CREATE TABLE password_reset_tokens (
    id          SERIAL PRIMARY KEY,
    business_id VARCHAR(8) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    token       VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
