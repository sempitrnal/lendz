-- Enable realtime for payment schedule changes across devices

-- Add payment_schedules and schedule_payments to the supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payment_schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE payment_schedules;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'schedule_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedule_payments;
  END IF;
END $$;

-- Enable RLS so realtime can use policies
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_payments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read changes (server-side actions still use service role for writes)
DROP POLICY IF EXISTS "payment_schedules_all" ON payment_schedules;
CREATE POLICY "payment_schedules_all" ON payment_schedules
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "schedule_payments_all" ON schedule_payments;
CREATE POLICY "schedule_payments_all" ON schedule_payments
  FOR ALL USING (true) WITH CHECK (true);
