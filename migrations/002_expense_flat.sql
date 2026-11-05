-- Link an expense to one flat. NULL stays a general overhead cost (staff salary, and similar).
-- Additive only. Existing expense rows are kept, with flat_id left empty.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS flat_id bigint REFERENCES public.flats (id);

CREATE INDEX IF NOT EXISTS expenses_flat_id_idx ON public.expenses (flat_id);
