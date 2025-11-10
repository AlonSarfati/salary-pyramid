CREATE TABLE IF NOT EXISTS ruleset (
  ruleset_id   TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_ruleset_tenant ON ruleset(tenant_id);

CREATE TABLE IF NOT EXISTS rule (
  rule_id        BIGSERIAL PRIMARY KEY,
  ruleset_id     TEXT NOT NULL REFERENCES ruleset(ruleset_id) ON DELETE CASCADE,
  target         TEXT NOT NULL,
  expression     TEXT NOT NULL,
  depends_on     JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from DATE NULL,
  effective_to   DATE NULL,
  UNIQUE (ruleset_id, target)
);
CREATE INDEX IF NOT EXISTS idx_rule_ruleset ON rule(ruleset_id);

CREATE TABLE IF NOT EXISTS tenant_active_ruleset (
  tenant_id   TEXT PRIMARY KEY,
  ruleset_id  TEXT NOT NULL REFERENCES ruleset(ruleset_id) ON DELETE RESTRICT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
