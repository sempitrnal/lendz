-- Add calculate_skipped_schedules column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS calculate_skipped_schedules BOOLEAN DEFAULT false;
