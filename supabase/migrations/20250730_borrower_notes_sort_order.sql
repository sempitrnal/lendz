-- Add sort_order to borrower_notes for manual ordering.
ALTER TABLE borrower_notes ADD COLUMN IF NOT EXISTS sort_order integer;
