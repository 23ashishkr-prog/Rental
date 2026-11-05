-- Rent due in a month is the latest rent_changes row with effective_month on or before that month.
-- If there is no such row, the app uses flats.monthly_rent.
-- Additive only. Existing flats, payments, and expenses are not changed.

CREATE TABLE IF NOT EXISTS public.rent_changes (
  id bigserial PRIMARY KEY,
  flat_id bigint NOT NULL REFERENCES public.flats (id),
  effective_month date NOT NULL,
  monthly_rent numeric(12,2) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flat_id, effective_month)
);
