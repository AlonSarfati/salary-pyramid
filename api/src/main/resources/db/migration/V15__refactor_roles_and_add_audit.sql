-- Migration V15: Refactor roles for clarity and add audit logging
-- This migration renames roles to be more explicit (SYSTEM_* vs TENANT_*)
-- and adds invite lifecycle and audit logging capabilities

-- ============================================================================
-- PART 1: Update access_allowlist roles (SYSTEM_*)
-- ============================================================================

-- Drop old CHECK constraint FIRST before updating values
ALTER TABLE access_allowlist DROP CONSTRAINT IF EXISTS access_allowlist_role_check;

-- Update existing ADMIN -> SYSTEM_ADMIN
UPDATE access_allowlist SET role = 'SYSTEM_ADMIN' WHERE role = 'ADMIN';

-- Update existing ANALYST -> SYSTEM_ANALYST
UPDATE access_allowlist SET role = 'SYSTEM_ANALYST' WHERE role = 'ANALYST';

-- Update existing VIEWER -> SYSTEM_VIEWER
UPDATE access_allowlist SET role = 'SYSTEM_VIEWER' WHERE role = 'VIEWER';

-- Add new CHECK constraint with backwards compatibility
ALTER TABLE access_allowlist ADD CONSTRAINT access_allowlist_role_check 
  CHECK (role IN ('SYSTEM_ADMIN', 'SYSTEM_ANALYST', 'SYSTEM_VIEWER', 'ADMIN', 'ANALYST', 'VIEWER'));

-- ============================================================================
-- PART 2: Update tenant_users roles (TENANT_*)
-- ============================================================================

-- Drop old CHECK constraint FIRST before updating values
ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check;

-- Update existing ADMIN -> TENANT_ADMIN
UPDATE tenant_users SET role = 'TENANT_ADMIN' WHERE role = 'ADMIN';

-- Update existing EDITOR -> TENANT_EDITOR
UPDATE tenant_users SET role = 'TENANT_EDITOR' WHERE role = 'EDITOR';

-- Update existing VIEWER -> TENANT_VIEWER
UPDATE tenant_users SET role = 'TENANT_VIEWER' WHERE role = 'VIEWER';

-- Add new CHECK constraint with backwards compatibility
ALTER TABLE tenant_users ADD CONSTRAINT tenant_users_role_check 
  CHECK (role IN ('TENANT_ADMIN', 'TENANT_EDITOR', 'TENANT_VIEWER', 'ADMIN', 'EDITOR', 'VIEWER'));

-- ============================================================================
-- PART 3: Update tenant_invites roles and add lifecycle columns
-- ============================================================================

-- Drop old CHECK constraint FIRST before updating values
ALTER TABLE tenant_invites DROP CONSTRAINT IF EXISTS tenant_invites_role_check;

-- Update existing ADMIN -> TENANT_ADMIN
UPDATE tenant_invites SET role = 'TENANT_ADMIN' WHERE role = 'ADMIN';

-- Update existing EDITOR -> TENANT_EDITOR
UPDATE tenant_invites SET role = 'TENANT_EDITOR' WHERE role = 'EDITOR';

-- Update existing VIEWER -> TENANT_VIEWER
UPDATE tenant_invites SET role = 'TENANT_VIEWER' WHERE role = 'VIEWER';

-- Add new CHECK constraint with backwards compatibility
ALTER TABLE tenant_invites ADD CONSTRAINT tenant_invites_role_check 
  CHECK (role IN ('TENANT_ADMIN', 'TENANT_EDITOR', 'TENANT_VIEWER', 'ADMIN', 'EDITOR', 'VIEWER'));

-- Add invite lifecycle columns
ALTER TABLE tenant_invites 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by_user_identity_id UUID REFERENCES user_identity(id);

-- Set default expires_at to 30 days from invited_at if null
UPDATE tenant_invites 
SET expires_at = invited_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Mark invites as EXPIRED if they're past expires_at
UPDATE tenant_invites
SET status = 'EXPIRED'
WHERE status = 'PENDING' AND expires_at < now();

-- Create indexes for invite lifecycle
CREATE INDEX IF NOT EXISTS idx_tenant_invites_status ON tenant_invites(status);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_expires_at ON tenant_invites(expires_at) WHERE status = 'PENDING';

-- ============================================================================
-- PART 4: Create tenant_audit_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 VARCHAR(255) NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_identity_id     UUID REFERENCES user_identity(id),
  actor_source              VARCHAR(50) NOT NULL CHECK (actor_source IN ('SYSTEM_ALLOWLIST', 'TENANT_MEMBERSHIP')),
  action_type               VARCHAR(100) NOT NULL,
  target_type               VARCHAR(50) NOT NULL CHECK (target_type IN ('USER', 'INVITE', 'SETTINGS')),
  target_id                 VARCHAR(255),
  diff_json                 JSONB,
  notes                     TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_tenant ON tenant_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_created_at ON tenant_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_actor ON tenant_audit_log(actor_user_identity_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_action ON tenant_audit_log(action_type);

