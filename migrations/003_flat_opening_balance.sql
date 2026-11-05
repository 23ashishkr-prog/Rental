-- Optional prior dues at the books-open month. Default 0.
-- Months before LEDGER_START_DATE are already treated as fully paid in the app.
-- This column is only for an extra balance an admin wants to carry in. Additive only.

ALTER TABLE public.flats
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0;
