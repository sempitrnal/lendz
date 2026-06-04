-- Add soft-delete support to borrowers table
alter table borrowers add column deleted_at timestamptz null;

-- Index for efficiently excluding soft-deleted borrowers
create index idx_borrowers_deleted_at on borrowers(deleted_at);
create index idx_borrowers_not_deleted on borrowers(deleted_at) where deleted_at is null;
