-- Add soft-delete support to accounts table
ALTER TABLE accounts ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of non-deleted accounts
CREATE INDEX idx_accounts_deleted_at ON accounts(deleted_at) WHERE deleted_at IS NULL;

-- Create index for querying recently deleted accounts
CREATE INDEX idx_accounts_deleted_at_not_null ON accounts(deleted_at) WHERE deleted_at IS NOT NULL;
