-- A payment counts toward payment_date unless for_month was explicitly chosen.
-- Additive only. Does not delete payment or rent rows.
-- The app applies the same statements the first time it reads the ledger.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS for_month_explicit boolean NOT NULL DEFAULT false;

-- Keep any override that is not the edit-form default stamped onto an imported row.
UPDATE public.payments
SET for_month_explicit = true
WHERE for_month IS NOT NULL
  AND for_month_explicit = false
  AND NOT (
    coalesce(method, '') = 'UPI'
    AND upi_ref IS NULL
    AND created_at < TIMESTAMP '2026-11-05 00:00:00+00'
    AND date_trunc('month', for_month) = DATE '2026-11-01'
    AND date_trunc('month', payment_date) <> DATE '2026-11-01'
  );

-- Clear that default. The method "UPI" on these rows was the form default, not a recorded reference.
UPDATE public.payments
SET for_month = NULL,
    method = CASE WHEN method = 'UPI' AND upi_ref IS NULL THEN NULL ELSE method END
WHERE for_month_explicit = false
  AND for_month IS NOT NULL
  AND coalesce(method, '') = 'UPI'
  AND upi_ref IS NULL
  AND created_at < TIMESTAMP '2026-11-05 00:00:00+00'
  AND date_trunc('month', for_month) = DATE '2026-11-01'
  AND date_trunc('month', payment_date) <> DATE '2026-11-01';
