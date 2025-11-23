-- Fix Flyway checksum mismatch for version 6
-- Since the employee table was dropped, we'll delete the history entry
-- and let Flyway re-run the migration with the new structure

-- Option 1: Delete the history entry for version 6 (recommended since table was dropped)
DELETE FROM flyway_schema_history WHERE version = '6';

-- Option 2: If you want to repair instead (update checksum to match new file):
-- UPDATE flyway_schema_history 
-- SET checksum = 506935270 
-- WHERE version = '6';

