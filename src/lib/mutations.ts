import "server-only";
import { AppError, ConfigError } from "./errors";
import { isAdminEmail, isValidEmail } from "./email";
import {
  asDate,
  asNumber,
  isForeignKeyViolation,
  isUndefinedTable,
  isUniqueViolation,
  markExpenseFlatReady,
  markOpeningBalanceReady,
  markRentChangesReady,
  missingColumn,
  sql,
} from "./db";
import { hashPassword } from "./passwords";
import { baselineRentChange } from "./rent";
import type { Actor } from "./types";
import { ownsFlat } from "./types";

export type FlatInput = {
  unitNumber: string;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  monthlyRent: number;
  rentStartDate: string | null;
  active: boolean;
  openingBalance: number;
};

export type PaymentInput = {
  flatId: number;
  amount: number;
  paymentDate: string;
  forMonth: string;
  method: string | null;
  upiRef: string | null;
  notes: string | null;
  status: "pending" | "confirmed" | "rejected";
};

export type ExpenseInput = {
  title: string;
  category: string | null;
  amount: number;
  expenseDate: string;
  notes: string | null;
  flatId: number | null;
};

const EXPENSE_FLAT_MIGRATION =
  "Expenses are not linked to flats yet. In the Neon SQL editor, run migrations/002_expense_flat.sql: ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS flat_id bigint REFERENCES public.flats (id);";

const OPENING_BALANCE_MIGRATION =
  "Flats cannot store an opening balance yet. In the Neon SQL editor, run migrations/003_flat_opening_balance.sql: ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2) NOT NULL DEFAULT 0;";

const RENT_CHANGES_MIGRATION =
  "Rent increases are not stored yet. In the Neon SQL editor, run migrations/004_rent_changes.sql: CREATE TABLE IF NOT EXISTS public.rent_changes (id bigserial PRIMARY KEY, flat_id bigint NOT NULL REFERENCES public.flats (id), effective_month date NOT NULL, monthly_rent numeric(12,2) NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (flat_id, effective_month));";

function assertAdmin(actor: Actor) {
  if (!actor.isAdmin) throw new AppError("Only an admin can do that.");
}

function assertOwnFlat(actor: Actor, flatId: number) {
  if (!ownsFlat(actor, flatId)) throw new AppError("That flat is not available on this account.");
}

export async function insertFlat(actor: Actor, input: FlatInput): Promise<number> {
  assertAdmin(actor);
  const values = [
    input.unitNumber,
    input.tenantName,
    input.monthlyRent,
    input.rentStartDate,
    input.tenantEmail,
    input.tenantPhone,
    input.active,
  ];
  try {
    const rows = await sql().query(
      `INSERT INTO flats (unit_number, tenant_name, monthly_rent, rent_start_date, tenant_email, tenant_phone, active, opening_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [...values, input.openingBalance],
    );
    markOpeningBalanceReady();
    return Number((rows[0] as { id: unknown }).id);
  } catch (error) {
    if (!missingColumn(error, "opening_balance")) throw error;
    if (input.openingBalance !== 0) throw new ConfigError(OPENING_BALANCE_MIGRATION);
    const rows = await sql().query(
      `INSERT INTO flats (unit_number, tenant_name, monthly_rent, rent_start_date, tenant_email, tenant_phone, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      values,
    );
    return Number((rows[0] as { id: unknown }).id);
  }
}

export async function updateFlat(actor: Actor, id: number, input: FlatInput): Promise<void> {
  assertAdmin(actor);
  const values = [
    input.unitNumber,
    input.tenantName,
    input.monthlyRent,
    input.rentStartDate,
    input.tenantEmail,
    input.tenantPhone,
    input.active,
    id,
  ];
  try {
    const rows = await sql().query(
      `UPDATE flats
       SET unit_number = $1, tenant_name = $2, monthly_rent = $3, rent_start_date = $4,
           tenant_email = $5, tenant_phone = $6, active = $7, opening_balance = $8
       WHERE id = $9
       RETURNING id`,
      [
        input.unitNumber,
        input.tenantName,
        input.monthlyRent,
        input.rentStartDate,
        input.tenantEmail,
        input.tenantPhone,
        input.active,
        input.openingBalance,
        id,
      ],
    );
    markOpeningBalanceReady();
    if (rows.length === 0) throw new AppError("That flat could not be found.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (!missingColumn(error, "opening_balance")) throw error;
    if (input.openingBalance !== 0) throw new ConfigError(OPENING_BALANCE_MIGRATION);
    const rows = await sql().query(
      `UPDATE flats
       SET unit_number = $1, tenant_name = $2, monthly_rent = $3, rent_start_date = $4,
           tenant_email = $5, tenant_phone = $6, active = $7
       WHERE id = $8
       RETURNING id`,
      values,
    );
    if (rows.length === 0) throw new AppError("That flat could not be found.");
  }
}

export async function deleteFlat(actor: Actor, id: number): Promise<void> {
  assertAdmin(actor);
  const counts = await sql().query(
    `SELECT
       (SELECT count(*) FROM payments WHERE flat_id = $1) AS payments,
       (SELECT count(*) FROM rent_adjustments WHERE flat_id = $1) AS adjustments,
       (SELECT count(*) FROM app_users WHERE flat_id = $1) AS users`,
    [id],
  );
  const row = counts[0] as { payments?: unknown; adjustments?: unknown; users?: unknown } | undefined;
  if (!row) throw new AppError("That flat could not be found.");
  let rentChanges = 0;
  try {
    const changeRows = await sql().query(`SELECT count(*) AS n FROM rent_changes WHERE flat_id = $1`, [id]);
    rentChanges = Number((changeRows[0] as { n?: unknown } | undefined)?.n ?? 0);
    markRentChangesReady();
  } catch (error) {
    if (!isUndefinedTable(error, "rent_changes")) throw error;
  }
  let expenses = 0;
  try {
    const expenseRows = await sql().query(`SELECT count(*) AS n FROM expenses WHERE flat_id = $1`, [id]);
    expenses = Number((expenseRows[0] as { n?: unknown } | undefined)?.n ?? 0);
    markExpenseFlatReady();
  } catch (error) {
    if (!missingColumn(error, "flat_id")) throw error;
  }
  const blocked = Number(row.payments) + Number(row.adjustments) + Number(row.users) + expenses + rentChanges;
  if (blocked > 0) {
    throw new AppError(
      "This flat has payments, adjustments, expenses, rent increases, or a linked login, so it cannot be deleted. Mark it inactive instead.",
    );
  }
  const deleted = await sql().query(`DELETE FROM flats WHERE id = $1 RETURNING id`, [id]);
  if (deleted.length === 0) throw new AppError("That flat could not be found.");
}

export type RentChangeInput = {
  id?: number;
  flatId: number;
  effectiveMonth: string;
  monthlyRent: number;
  note: string | null;
  updateCurrent: boolean;
};

function rentChangeError(error: unknown): never {
  if (isUndefinedTable(error, "rent_changes")) throw new ConfigError(RENT_CHANGES_MIGRATION);
  if (isUniqueViolation(error)) {
    throw new AppError("This flat already has a rent for that month. Edit that entry instead.");
  }
  if (isForeignKeyViolation(error)) throw new AppError("That flat could not be found.");
  throw error;
}

async function applyLatestRent(flatId: number): Promise<void> {
  const flatRows = await sql().query(`SELECT monthly_rent, rent_start_date FROM flats WHERE id = $1`, [flatId]);
  const flat = flatRows[0] as { monthly_rent?: unknown; rent_start_date?: unknown } | undefined;
  if (!flat) return;
  const storedRent = asNumber(flat.monthly_rent);
  const rentStartDate = asDate(flat.rent_start_date);
  const changeRows = await sql().query(
    `SELECT effective_month, monthly_rent FROM rent_changes WHERE flat_id = $1 ORDER BY effective_month ASC, id ASC`,
    [flatId],
  );
  const changes = (changeRows as { effective_month?: unknown; monthly_rent?: unknown }[])
    .map((row) => ({
      effectiveMonth: asDate(row.effective_month) ?? "",
      monthlyRent: asNumber(row.monthly_rent),
    }))
    .filter((change) => change.effectiveMonth);
  const baseline = baselineRentChange({ rentStartDate, storedRent, changes });
  if (baseline) {
    await sql().query(
      `INSERT INTO rent_changes (flat_id, effective_month, monthly_rent, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (flat_id, effective_month) DO NOTHING`,
      [flatId, baseline.effectiveMonth, baseline.monthlyRent, "Previous rent"],
    );
  }
  const latest = [...changes, ...(baseline ? [baseline] : [])].sort((a, b) =>
    a.effectiveMonth.localeCompare(b.effectiveMonth),
  ).at(-1);
  if (!latest) return;
  await sql().query(`UPDATE flats SET monthly_rent = $1 WHERE id = $2`, [latest.monthlyRent, flatId]);
}

export async function saveRentChange(actor: Actor, input: RentChangeInput): Promise<void> {
  assertAdmin(actor);
  try {
    if (input.id) {
      const rows = await sql().query(
        `UPDATE rent_changes
         SET effective_month = $1, monthly_rent = $2, note = $3
         WHERE id = $4 AND flat_id = $5
         RETURNING id`,
        [input.effectiveMonth, input.monthlyRent, input.note, input.id, input.flatId],
      );
      if (rows.length === 0) throw new AppError("That rent change could not be found.");
    } else {
      await sql().query(
        `INSERT INTO rent_changes (flat_id, effective_month, monthly_rent, note)
         VALUES ($1, $2, $3, $4)`,
        [input.flatId, input.effectiveMonth, input.monthlyRent, input.note],
      );
    }
    markRentChangesReady();
  } catch (error) {
    if (error instanceof AppError || error instanceof ConfigError) throw error;
    rentChangeError(error);
  }
  if (input.updateCurrent) await applyLatestRent(input.flatId);
}

export async function deleteRentChange(actor: Actor, id: number): Promise<number> {
  assertAdmin(actor);
  try {
    const rows = await sql().query(`DELETE FROM rent_changes WHERE id = $1 RETURNING flat_id`, [id]);
    if (rows.length === 0) throw new AppError("That rent change could not be found.");
    return Number((rows[0] as { flat_id?: unknown }).flat_id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    rentChangeError(error);
  }
}

export async function insertPayment(actor: Actor, input: PaymentInput): Promise<number> {
  assertOwnFlat(actor, input.flatId);
  if (!actor.isAdmin && input.status !== "pending") {
    throw new AppError("Tenant payments stay pending until an admin confirms them.");
  }
  const rows = await sql().query(
    `INSERT INTO payments (flat_id, payment_date, amount, notes, for_month, method, upi_ref, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.flatId,
      input.paymentDate,
      input.amount,
      input.notes,
      input.forMonth,
      input.method,
      input.upiRef,
      input.status,
    ],
  );
  return Number((rows[0] as { id: unknown }).id);
}

export async function updatePayment(actor: Actor, id: number, input: PaymentInput): Promise<void> {
  assertAdmin(actor);
  const rows = await sql().query(
    `UPDATE payments
     SET flat_id = $1, payment_date = $2, amount = $3, notes = $4, for_month = $5, method = $6, upi_ref = $7, status = $8
     WHERE id = $9
     RETURNING id`,
    [
      input.flatId,
      input.paymentDate,
      input.amount,
      input.notes,
      input.forMonth,
      input.method,
      input.upiRef,
      input.status,
      id,
    ],
  );
  if (rows.length === 0) throw new AppError("That payment could not be found.");
}

export async function setPaymentStatus(
  actor: Actor,
  id: number,
  status: "confirmed" | "rejected",
): Promise<void> {
  assertAdmin(actor);
  const rows = await sql().query(
    `UPDATE payments SET status = $1 WHERE id = $2 RETURNING id`,
    [status, id],
  );
  if (rows.length === 0) throw new AppError("That payment could not be found.");
}

export async function deletePayment(actor: Actor, id: number): Promise<void> {
  assertAdmin(actor);
  const rows = await sql().query(`DELETE FROM payments WHERE id = $1 RETURNING id`, [id]);
  if (rows.length === 0) throw new AppError("That payment could not be found.");
}

function expenseValues(input: ExpenseInput): unknown[] {
  return [input.title, input.category, input.amount, input.expenseDate, input.notes];
}

export async function insertExpense(actor: Actor, input: ExpenseInput): Promise<number> {
  assertAdmin(actor);
  try {
    const rows = await sql().query(
      `INSERT INTO expenses (title, category, amount, expense_date, notes, flat_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [...expenseValues(input), input.flatId],
    );
    markExpenseFlatReady();
    return Number((rows[0] as { id: unknown }).id);
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new AppError("That flat could not be found.");
    if (!missingColumn(error, "flat_id")) throw error;
    if (input.flatId != null) throw new ConfigError(EXPENSE_FLAT_MIGRATION);
    const rows = await sql().query(
      `INSERT INTO expenses (title, category, amount, expense_date, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      expenseValues(input),
    );
    return Number((rows[0] as { id: unknown }).id);
  }
}

export async function updateExpense(actor: Actor, id: number, input: ExpenseInput): Promise<void> {
  assertAdmin(actor);
  try {
    const rows = await sql().query(
      `UPDATE expenses
       SET title = $1, category = $2, amount = $3, expense_date = $4, notes = $5, flat_id = $6
       WHERE id = $7
       RETURNING id`,
      [...expenseValues(input), input.flatId, id],
    );
    markExpenseFlatReady();
    if (rows.length === 0) throw new AppError("That expense could not be found.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isForeignKeyViolation(error)) throw new AppError("That flat could not be found.");
    if (!missingColumn(error, "flat_id")) throw error;
    if (input.flatId != null) throw new ConfigError(EXPENSE_FLAT_MIGRATION);
    const rows = await sql().query(
      `UPDATE expenses
       SET title = $1, category = $2, amount = $3, expense_date = $4, notes = $5
       WHERE id = $6
       RETURNING id`,
      [...expenseValues(input), id],
    );
    if (rows.length === 0) throw new AppError("That expense could not be found.");
  }
}

export async function deleteExpense(actor: Actor, id: number): Promise<void> {
  assertAdmin(actor);
  const rows = await sql().query(`DELETE FROM expenses WHERE id = $1 RETURNING id`, [id]);
  if (rows.length === 0) throw new AppError("That expense could not be found.");
}

export async function insertAdjustment(
  actor: Actor,
  input: { flatId: number; month: string; amount: number; reason: string | null },
): Promise<void> {
  assertAdmin(actor);
  await sql().query(
    `INSERT INTO rent_adjustments (flat_id, month, amount, reason, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.flatId, input.month, input.amount, input.reason, actor.id],
  );
}

export async function deleteAdjustment(actor: Actor, id: number): Promise<number | null> {
  assertAdmin(actor);
  const rows = await sql().query(
    `DELETE FROM rent_adjustments WHERE id = $1 RETURNING flat_id`,
    [id],
  );
  if (rows.length === 0) throw new AppError("That adjustment could not be found.");
  return Number((rows[0] as { flat_id: unknown }).flat_id);
}

export async function setInitialPassword(userId: number, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  const rows = await sql().query(
    `UPDATE app_users
     SET password_hash = $1, password_set_at = now()
     WHERE id = $2 AND password_hash IS NULL
     RETURNING id`,
    [passwordHash, userId],
  );
  return rows.length > 0;
}

export async function updatePassword(userId: number, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await sql().query(
    `UPDATE app_users SET password_hash = $1, password_set_at = now() WHERE id = $2`,
    [passwordHash, userId],
  );
}

export async function inviteTenant(
  actor: Actor,
  input: { flatId: number; email: string; name: string | null; phone: string | null },
): Promise<void> {
  assertAdmin(actor);
  if (!isValidEmail(input.email)) throw new AppError("Enter a valid email address.");
  if (isAdminEmail(input.email)) throw new AppError("That email belongs to an admin and cannot be invited as a tenant.");
  const email = input.email.trim().toLowerCase();
  const existing = await sql().query(`SELECT id, role, email FROM app_users WHERE lower(trim(email)) = $1`, [
    email,
  ]);
  const row = existing[0] as { role?: string; email?: string } | undefined;
  if (row && (row.role === "admin" || isAdminEmail(String(row.email)))) {
    throw new AppError("That email belongs to an admin and cannot be invited as a tenant.");
  }

  const db = sql();
  try {
    await db.transaction([
      db`UPDATE flats
        SET tenant_email = ${email},
            tenant_name = COALESCE(${input.name}, tenant_name),
            tenant_phone = COALESCE(${input.phone}, tenant_phone)
        WHERE id = ${input.flatId}`,
      db`INSERT INTO app_users (email, name, role, flat_id)
        VALUES (${email}, ${input.name}, 'tenant', ${input.flatId})
        ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            flat_id = EXCLUDED.flat_id,
            role = 'tenant'
        WHERE app_users.role <> 'admin'`,
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("That email could not be saved. It may already belong to another login.");
    }
    if (error && typeof error === "object" && (error as { code?: string }).code === "23503") {
      throw new AppError("Choose a flat that exists.");
    }
    throw error;
  }
}
