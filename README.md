# Ordinary Rent

Mobile-first rent book for one building. Admins manage flats, payments, expenses, and adjustments. Tenants see only their own flat, pay by UPI, and submit the reference for confirmation.

The live data already sits in Neon (`flats`, `payments`, `expenses`, `rent_adjustments`, `app_users`). This app does not create that schema and does not delete or rewrite existing rows.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (`-pooler` in the host). The app uses `@neondatabase/serverless`. |
| `AUTH_SECRET` | Random string, 16+ characters. Signs the httpOnly login cookie. `openssl rand -base64 32` |

Never commit `.env.local` or a real `DATABASE_URL`. `.env.example` has placeholders only.

### Migration the owner must run

Before anyone can sign in, run this **once** in the Neon SQL editor. It only adds columns:

```sql
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;
```

The same script is in `migrations/001_app_users_password.sql`. Do not drop, truncate, or rebuild the existing tables.

Two later migrations are also additive. Run them once in the Neon SQL editor when you want flat profit and an optional opening balance:

```sql
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS flat_id bigint REFERENCES public.flats (id);

ALTER TABLE public.flats
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0;
```

`flat_id` empty means a general cost (staff salary, for example). `opening_balance` defaults to 0. The same statements are in `migrations/002_expense_flat.sql` and `migrations/003_flat_opening_balance.sql`.

`LEDGER_START_DATE` (default `2026-04-01`) is the first month rent can be charged. Each flat starts at the later of that month and its `rent_start_date`. Months from `rent_start_date` through the month before it are shown as one line, **Paid (before Apr 2026)**, and are not pending. No payment rows are inserted for that history. Set `LEDGER_START_DATE` in Vercel only if the books should open on a different month.

Rent for a month is the latest `rent_changes` row with `effective_month` on or before that month. If there is no row, the flat's `monthly_rent` is used. Add increases from the flat page. The optional checkbox also stores the latest amount on the flat and keeps the previous amount for earlier months. Run this once:

```sql
CREATE TABLE IF NOT EXISTS public.rent_changes (
  id bigserial PRIMARY KEY,
  flat_id bigint NOT NULL REFERENCES public.flats (id),
  effective_month date NOT NULL,
  monthly_rent numeric(12,2) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flat_id, effective_month)
);
```

The same statement is in `migrations/004_rent_changes.sql`.

```bash
npm test
npm run dev
```

Open http://localhost:3000.

## Sign-in

There is no public signup.

1. The email must already be in `app_users` (the two admins are seeded there) or be invited by an admin.
2. If `password_hash` is empty, the first visit asks that person to choose a password (8+ characters).
3. Later visits need the email and that password.
4. The session is an httpOnly cookie (`rent_session`) signed with `AUTH_SECRET`, valid for 30 days. Every page loads the user from the database again, so a removed login stops working immediately.

Anyone who knows a listed email can set the password **while it is still empty**. Invite people only when they are ready to sign in, or set the first password yourself while you are with them.

Gmail addresses are matched ignoring dots and letter case (`23.ashish.kr@gmail.com` and `23.ashishkr@gmail.com` are the same person, including `@googlemail.com`). Plus-tags are not ignored.

Admins:

- `sudi.chandra@gmail.com`
- `23.ashish.kr@gmail.com`

An admin is anyone whose address matches those, or whose `app_users.role` is `admin`. Everyone else is a tenant.

## Who sees what

Authorization is applied in the server queries, not only in the UI.

- Admins can list and edit every flat, payment, expense, and adjustment, confirm or reject tenant submissions, invite tenants, and export the report.
- A tenant is limited to `app_users.flat_id` and any flat whose `tenant_email` matches their login (same Gmail rules). They can see rent due, total paid, pending amount, pending months, payment history, and their monthly report. They cannot read other flats, expenses, or the portfolio dashboard.

## Rent math

For each flat, full `monthly_rent` is charged from the month of `rent_start_date` through the month you are viewing (dates in Asia/Kolkata). There is no mid-month proration.

- A `rent_adjustments` row adds to that month (negative amount is a discount or waiver).
- A **confirmed** payment counts toward `payments.for_month`. Older rows with an empty `for_month` count toward the `payment_date` month. A blank status counts as confirmed.
- Months before `LEDGER_START_DATE` are treated as fully paid. The balance at the first charged month is `opening_balance` (0 unless you set one).
- The rent charged in a month comes from `rent_changes` when one is in force, otherwise from `flats.monthly_rent`. A payment of the old amount after an increase leaves the difference pending.
- Pending and rejected payments do not reduce the balance.
- Unpaid balance carries into the next month. An overpayment carries as credit. A payment tagged to a **future** month is advance and does not reduce what is due through the month on screen.
- Pending months is how many charged months are still uncovered after that carry-forward. A partly covered month counts as pending.

## UPI

Tenants (and an admin showing a phone) get a Pay button and QR code for `9742515588@upi` with the amount filled in:

`upi://pay?pa=9742515588@upi&pn=Rent&am=...&cu=INR&tn=...`

They then submit the UPI reference and an optional comment. That row is stored as `payments.status = 'pending'` until an admin confirms or rejects it on **Pending confirmations**. An admin who submits that same form is stored as confirmed.

## Deploy on Vercel

1. Import this GitHub repo in Vercel. Framework preset: Next.js.
2. Set `DATABASE_URL` and `AUTH_SECRET` for Production (and Preview, if you want preview logins). Use the pooled Neon URL.
3. Run the migration above against the existing database before sharing the URL.
4. Deploy. `npm run build` is the production build.

No extra auth provider, database host, or cron job is required.

## Scripts

- `npm run dev` — local app
- `npm test` — rent math, books-open date, profit, Gmail admin matching, and the UPI link
- `npm run build` — production build
- `npm run lint` — ESLint
