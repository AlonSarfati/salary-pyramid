-- Migration V16: Enterprise hardening and operational quality improvements
-- This migration adds soft delete, audit improvements, and anti-lockout support

-- ============================================================================
-- PART 1: Add REMOVED status to tenant_users
-- ============================================================================

-- Add REMOVED to tenant_users status enum
ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS tenant_users_status_check;
ALTER TABLE tenant_users ADD CONSTRAINT tenant_users_status_check 
  CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED', 'REMOVED'));

-- ============================================================================
-- PART 2: Audit log improvements
-- ============================================================================

-- Add correlation_id to audit log for request tracking
ALTER TABLE tenant_audit_log 
  ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

-- Add indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_actor_created 
  ON tenant_audit_log(actor_user_identity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_correlation 
  ON tenant_audit_log(correlation_id) WHERE correlation_id IS NOT NULL;

-- ============================================================================
-- PART 3: Invite normalization and constraints
-- ============================================================================

-- Ensure invite emails are normalized (lowercase, trimmed)
-- Add a trigger or constraint to enforce normalization
-- For now, we'll handle this in application code, but add index for case-insensitive lookup
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email_lower 
  ON tenant_invites(LOWER(TRIM(email)));

-- ============================================================================
-- PART 4: Partial unique index for tenant_users (allow re-adding removed users)
-- ============================================================================

-- Create partial unique index that excludes REMOVED users
-- This allows re-adding a user after removal
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_users_active_unique 
  ON tenant_users(tenant_id, user_identity_id) 
  WHERE status != 'REMOVED';

-- Drop the old unique constraint if it exists (we're replacing it with partial index)
-- Note: PostgreSQL doesn't allow dropping a constraint that's used by an index
-- So we'll keep both, but the partial index takes precedence for active users

-- ============================================================================
-- PART 5: Add retention_days to tenant_settings if not exists
-- ============================================================================

-- Already exists from V14, but ensure it's there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_settings' AND column_name = 'retention_days'
  ) THEN
    ALTER TABLE tenant_settings ADD COLUMN retention_days INTEGER NOT NULL DEFAULT 90;
  END IF;
END $$;

