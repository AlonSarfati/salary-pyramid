CREATE TABLE IF NOT EXISTS comp_table (
  tenant_id        TEXT        NOT NULL,
  component_target TEXT        NOT NULL,
  table_name       TEXT        NOT NULL,
  description      TEXT,
  columns_json     JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, component_target, table_name)
);

CREATE TABLE IF NOT EXISTS comp_table_row (
  tenant_id        TEXT        NOT NULL,
  component_target TEXT        NOT NULL,
  table_name       TEXT        NOT NULL,
  effective_from   DATE        NOT NULL DEFAULT '1900-01-01',
  effective_to     DATE        NOT NULL DEFAULT '9999-12-31',
  keys_json        JSONB       NOT NULL,
  value            NUMERIC(18,2) NOT NULL,
  meta             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, component_target, table_name, effective_from, keys_json),
  FOREIGN KEY (tenant_id, component_target, table_name)
    REFERENCES comp_table(tenant_id, component_target, table_name)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comp_row_lookup
  ON comp_table_row(tenant_id, component_target, table_name, effective_from, effective_to);
