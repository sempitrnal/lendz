-- Add sort_order to categories for manual ordering in due-this-month
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer;
