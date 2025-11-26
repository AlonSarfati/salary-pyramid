-- Add EUR (Euro) currency support to tenant table
-- Update the CHECK constraint to include EUR
ALTER TABLE tenant 
  DROP CONSTRAINT IF EXISTS tenant_currency_check;

ALTER TABLE tenant 
  ADD CONSTRAINT tenant_currency_check 
  CHECK (currency IN ('USD', 'ILS', 'EUR'));

