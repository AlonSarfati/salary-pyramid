-- Add 'optimization' as a valid simulation_type for scenarios
-- Drop the existing constraint and recreate it with the new value
ALTER TABLE scenario DROP CONSTRAINT IF EXISTS scenario_simulation_type_check;

-- If the constraint has a different auto-generated name, try to find and drop it
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find the constraint name that checks simulation_type
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'scenario'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%simulation_type%';
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE scenario DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

-- Add the new constraint with all three types
ALTER TABLE scenario ADD CONSTRAINT scenario_simulation_type_check 
  CHECK (simulation_type IN ('single', 'bulk', 'optimization'));

