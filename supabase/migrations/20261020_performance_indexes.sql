-- Indexes for the reads the app makes most. The base tables are not created in
-- this repo's migrations, so this only adds indexes (IF NOT EXISTS, so it is
-- safe to run even where some already exist under another name). Compare with
-- `select indexname, indexdef from pg_indexes where schemaname = 'public'`
-- first and skip any that are already covered.
--
-- Not run from here: apply it in the Supabase SQL Editor. On a large table,
-- `CREATE INDEX CONCURRENTLY` avoids blocking writes, but it cannot run inside
-- a transaction, so it is left out of this file.

-- Schedules by account, in due order: account pages, the borrower and account
-- lists, snapshots before an edit.
CREATE INDEX IF NOT EXISTS idx_payment_schedules_account_due
  ON payment_schedules (account_id, due_date);

-- What is still owed, by due date: the checklist's due-collections read, the
-- due-this-month and upcoming pages, the overdue job.
CREATE INDEX IF NOT EXISTS idx_payment_schedules_open_due
  ON payment_schedules (due_date)
  WHERE status <> 'paid';

-- Payments by schedule, and by date (this month's payments on a borrower).
CREATE INDEX IF NOT EXISTS idx_schedule_payments_schedule
  ON schedule_payments (schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_payments_date
  ON schedule_payments (payment_date);

-- A borrower's live accounts. The existing idx_accounts_deleted_at indexes only
-- the deleted_at column, which is always NULL under its own predicate, so it
-- does not help this lookup.
CREATE INDEX IF NOT EXISTS idx_accounts_borrower_live
  ON accounts (borrower_id)
  WHERE deleted_at IS NULL;

-- Borrowers newest first, live only (the borrower list).
CREATE INDEX IF NOT EXISTS idx_borrowers_created_live
  ON borrowers (created_at DESC)
  WHERE deleted_at IS NULL;

-- Category links, read from both sides.
CREATE INDEX IF NOT EXISTS idx_borrower_categories_borrower
  ON borrower_categories (borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrower_categories_category
  ON borrower_categories (category_id);

-- A borrower's notes.
CREATE INDEX IF NOT EXISTS idx_borrower_notes_borrower
  ON borrower_notes (borrower_id, created_at DESC);

-- The checklist: one day's items in order, on every load and refetch.
CREATE INDEX IF NOT EXISTS idx_daily_checklist_items_day
  ON daily_checklist_items (checklist_date, sort_order, created_at);
