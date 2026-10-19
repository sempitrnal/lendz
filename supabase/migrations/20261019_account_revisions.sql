-- Snapshots of an account, its payment schedules and their payment records,
-- taken right before an edit changes them, so the edit can be reverted.
-- (schedule_payments cascade-delete with their schedule, so without this an
-- edit that drops schedules loses that payment history for good.)
CREATE TABLE IF NOT EXISTS account_revisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- What prompted the snapshot, e.g. 'account.updated' or 'account.reverted'.
  reason TEXT NOT NULL,
  account JSONB NOT NULL,
  schedules JSONB NOT NULL,
  payments JSONB NOT NULL,
  -- Set once this snapshot has been restored.
  reverted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_revisions_account
  ON account_revisions(account_id, created_at DESC);

ALTER TABLE account_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can manage account revisions"
  ON account_revisions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
