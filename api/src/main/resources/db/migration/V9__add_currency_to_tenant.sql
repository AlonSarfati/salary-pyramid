-- Add currency column to tenant table
ALTER TABLE tenant 
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD' 
  CHECK (currency IN ('USD', 'ILS'));

-- Update existing tenants to have USD as default (already set by DEFAULT clause)
-- No explicit UPDATE needed as DEFAULT will handle it

-- Create index for currency lookups if needed
CREATE INDEX IF NOT EXISTS idx_tenant_currency ON tenant(currency);

