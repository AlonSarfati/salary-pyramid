-- Create scenarios table for saving simulation results
CREATE TABLE IF NOT EXISTS scenario (
  scenario_id   TEXT        NOT NULL,
  tenant_id     TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  ruleset_id    TEXT        NOT NULL,
  pay_month     TEXT        NOT NULL, -- YYYY-MM format
  input_data    JSONB       NOT NULL DEFAULT '{}'::jsonb, -- Employee input parameters
  result_data   JSONB       NOT NULL DEFAULT '{}'::jsonb, -- Simulation results (components, total, etc.)
  simulation_type TEXT      NOT NULL DEFAULT 'single' CHECK (simulation_type IN ('single', 'bulk')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scenario_tenant ON scenario(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scenario_tenant_created ON scenario(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_ruleset ON scenario(tenant_id, ruleset_id);

