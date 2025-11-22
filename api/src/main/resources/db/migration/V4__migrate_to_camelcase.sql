-- Migration to update existing rules from ${ComponentName} syntax to CamelCase
-- This updates component names and expressions to use the new CamelCase syntax

-- Update target names to CamelCase
UPDATE rule
SET target = CASE 
    WHEN target = 'Base' THEN 'BaseSalary'
    WHEN target = 'Expert Bonus' THEN 'ExpertBonus'
    WHEN target = 'Responsibility Bonus' THEN 'ResponsibilityBonus'
    WHEN target = 'Full Bonus' THEN 'FullBonus'
    WHEN target = 'Fixed Travel' THEN 'FixedTravel'
    ELSE target
END
WHERE target IN ('Base', 'Expert Bonus', 'Responsibility Bonus', 'Full Bonus', 'Fixed Travel');

-- Update expressions: replace ${ComponentName} with CamelCase
UPDATE rule
SET expression = REPLACE(expression, '${Base}', 'BaseSalary')
WHERE expression LIKE '%${Base}%';

UPDATE rule
SET expression = REPLACE(expression, '${Expert Bonus}', 'ExpertBonus')
WHERE expression LIKE '%${Expert Bonus}%';

UPDATE rule
SET expression = REPLACE(expression, '${Responsibility Bonus}', 'ResponsibilityBonus')
WHERE expression LIKE '%${Responsibility Bonus}%';

-- Update depends_on JSONB arrays: replace component names with CamelCase
UPDATE rule
SET depends_on = (
    SELECT jsonb_agg(
        CASE 
            WHEN elem = '"Base"' THEN '"BaseSalary"'
            WHEN elem = '"Expert Bonus"' THEN '"ExpertBonus"'
            WHEN elem = '"Responsibility Bonus"' THEN '"ResponsibilityBonus"'
            WHEN elem = '"Full Bonus"' THEN '"FullBonus"'
            WHEN elem = '"Fixed Travel"' THEN '"FixedTravel"'
            ELSE elem
        END
    )
    FROM jsonb_array_elements(depends_on) AS elem
)
WHERE depends_on::text LIKE '%"Base"%'
   OR depends_on::text LIKE '%"Expert Bonus"%'
   OR depends_on::text LIKE '%"Responsibility Bonus"%'
   OR depends_on::text LIKE '%"Full Bonus"%'
   OR depends_on::text LIKE '%"Fixed Travel"%';

