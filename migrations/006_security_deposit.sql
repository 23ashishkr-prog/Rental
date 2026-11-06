-- Optional security deposit held for a flat. Not rent.
-- Does not change dues, payments, pending, or profit.
-- Additive only. Existing rows stay NULL until an admin enters a deposit.
-- Do not drop this column or delete flat rows.

ALTER TABLE public.flats
  ADD COLUMN IF NOT EXISTS security_deposit numeric(12,2);
