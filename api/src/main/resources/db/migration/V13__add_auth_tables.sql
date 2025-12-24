-- Create user_identity table
CREATE TABLE IF NOT EXISTS user_identity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer        VARCHAR(500) NOT NULL,
  subject       VARCHAR(500) NOT NULL,
  email         VARCHAR(255),
  display_name  VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  UNIQUE(issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_identity_issuer_subject ON user_identity(issuer, subject);
CREATE INDEX IF NOT EXISTS idx_user_identity_email ON user_identity(email) WHERE email IS NOT NULL;

-- Create access_allowlist table
CREATE TABLE IF NOT EXISTS access_allowlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255),
  issuer        VARCHAR(500),
  subject       VARCHAR(500),
  status        VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
  mode          VARCHAR(50) NOT NULL CHECK (mode IN ('SINGLE_TENANT', 'MULTI_TENANT')),
  role          VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'ANALYST', 'VIEWER')),
  created_by    VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_allowlist_email ON access_allowlist(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_allowlist_issuer_subject ON access_allowlist(issuer, subject) WHERE issuer IS NOT NULL AND subject IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_allowlist_status ON access_allowlist(status);

-- Create allowlist_tenants table
CREATE TABLE IF NOT EXISTS allowlist_tenants (
  allowlist_id  UUID NOT NULL REFERENCES access_allowlist(id) ON DELETE CASCADE,
  tenant_id     VARCHAR(255) NOT NULL,
  PRIMARY KEY (allowlist_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_allowlist_tenants_tenant ON allowlist_tenants(tenant_id);

