-- Calendar events for scheduling borrowers/loans
CREATE TABLE calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  event_date DATE NOT NULL,
  title TEXT,
  note TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_events_borrower ON calendar_events(borrower_id);
CREATE INDEX idx_calendar_events_account ON calendar_events(account_id);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations" ON calendar_events
  FOR ALL USING (true) WITH CHECK (true);
