-- Fix accounts status constraint to allow 'pending'
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_status_check;

-- Normalize any unexpected values to 'active' so the new constraint succeeds
UPDATE accounts SET status = 'active' WHERE status NOT IN ('active', 'pending');

-- Re-add the check constraint with both active and pending
ALTER TABLE accounts ADD CONSTRAINT accounts_status_check CHECK (status IN ('active', 'pending'));
