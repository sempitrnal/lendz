-- A borrower's Messenger username, for the "message" button (opens m.me/<username>).
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS messenger_username text;
