-- Additive only. Do not drop, truncate, or rewrite existing rows.
-- Run this once in the Neon SQL editor (or psql) before anyone signs in.
-- Existing admin and tenant rows keep working; password_hash stays null
-- until that person chooses a password on first login.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;

COMMENT ON COLUMN public.app_users.password_hash IS
  'scrypt password hash (scrypt$salt$hash). Null until first login sets a password.';
