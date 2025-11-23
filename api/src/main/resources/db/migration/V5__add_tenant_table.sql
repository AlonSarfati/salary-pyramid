-- Create tenant table
CREATE TABLE IF NOT EXISTS tenant (
  tenant_id    TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraints to existing tables
-- First, ensure all existing tenant_ids in ruleset exist in tenant table
INSERT INTO tenant (tenant_id, name, status)
SELECT DISTINCT tenant_id, tenant_id, 'ACTIVE'
FROM ruleset
WHERE tenant_id NOT IN (SELECT tenant_id FROM tenant)
ON CONFLICT (tenant_id) DO NOTHING;

-- Add foreign key constraint to ruleset table
ALTER TABLE ruleset
  ADD CONSTRAINT fk_ruleset_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE RESTRICT;

-- Add foreign key constraint to tenant_active_ruleset table
ALTER TABLE tenant_active_ruleset
  ADD CONSTRAINT fk_tenant_active_ruleset_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE;

-- Add foreign key constraint to comp_table table
ALTER TABLE comp_table
  ADD CONSTRAINT fk_comp_table_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE;

-- Add foreign key constraint to comp_table_row table (via comp_table)
-- Note: comp_table_row already has a foreign key to comp_table which includes tenant_id

-- Create index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenant(status);

-- Seed default tenant if it doesn't exist
INSERT INTO tenant (tenant_id, name, status)
VALUES ('default', 'Default Tenant', 'ACTIVE')
ON CONFLICT (tenant_id) DO UPDATE SET name = 'Default Tenant', status = 'ACTIVE';

