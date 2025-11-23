-- Create employee table
CREATE TABLE IF NOT EXISTS employee (
  employee_id   TEXT        PRIMARY KEY,
  tenant_id     TEXT        NOT NULL,
  name          TEXT,
  data_json     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id) ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_employee_tenant ON employee(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_name ON employee(tenant_id, name);

