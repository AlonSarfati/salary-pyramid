-- Tenant Users: users assigned to a specific tenant with roles
CREATE TABLE IF NOT EXISTS tenant_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     VARCHAR(255) NOT NULL,
  user_identity_id UUID NOT NULL REFERENCES user_identity(id) ON DELETE CASCADE,
  role          VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
  status        VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_identity_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_identity ON tenant_users(user_identity_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_status ON tenant_users(status);

-- Tenant Invites: pending invitations to join a tenant
CREATE TABLE IF NOT EXISTS tenant_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
  invited_by    UUID REFERENCES user_identity(id),
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant ON tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites(email);

-- Tenant Settings: configuration for each tenant
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id                    VARCHAR(255) PRIMARY KEY,
  name                        VARCHAR(255) NOT NULL,
  timezone                    VARCHAR(100) NOT NULL DEFAULT 'UTC',
  currency                    VARCHAR(10) NOT NULL DEFAULT 'USD',
  locale                      VARCHAR(20) NOT NULL DEFAULT 'en-US',
  rounding                    VARCHAR(50) NOT NULL DEFAULT 'NONE' CHECK (rounding IN ('NONE', 'NEAREST_0_5', 'NEAREST_1')),
  retention_days              INTEGER NOT NULL DEFAULT 90,
  export_csv                  BOOLEAN NOT NULL DEFAULT true,
  export_xlsx                 BOOLEAN NOT NULL DEFAULT true,
  export_pdf                  BOOLEAN NOT NULL DEFAULT false,
  session_timeout_minutes     INTEGER NOT NULL DEFAULT 30,
  allowed_email_domains       TEXT[], -- Array of allowed domains
  require_sso                 BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initialize tenant_settings for existing tenants
INSERT INTO tenant_settings (tenant_id, name)
SELECT tenant_id, name FROM tenant
ON CONFLICT (tenant_id) DO NOTHING;

