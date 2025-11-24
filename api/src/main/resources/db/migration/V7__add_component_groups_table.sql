-- Create component_groups table
CREATE TABLE IF NOT EXISTS component_groups (
  group_name    TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  color         TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_component_groups_order ON component_groups(display_order);

-- Insert default groups
INSERT INTO component_groups (group_name, display_name, color, display_order)
VALUES
  ('core', 'Core', '#0052CC', 1),
  ('bonus', 'Bonus', '#10B981', 2),
  ('extra hours', 'Extra Hours', '#F59E0B', 3),
  ('expenses', 'Expenses', '#8B5CF6', 4)
ON CONFLICT (group_name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    color = EXCLUDED.color,
    display_order = EXCLUDED.display_order,
    updated_at = now();

