-- Enable realtime for borrower-related changes across devices

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'borrowers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE borrowers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'borrower_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE borrower_categories;
  END IF;
END $$;

-- Enable RLS so realtime can use policies
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_categories ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read changes (server-side actions still use service role for writes)
DROP POLICY IF EXISTS "borrowers_all" ON borrowers;
CREATE POLICY "borrowers_all" ON borrowers
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "accounts_all" ON accounts;
CREATE POLICY "accounts_all" ON accounts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "borrower_categories_all" ON borrower_categories;
CREATE POLICY "borrower_categories_all" ON borrower_categories
  FOR ALL USING (true) WITH CHECK (true);
