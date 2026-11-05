import "server-only";
import { AppError } from "./errors";
import { isAdminEmail, isValidEmail } from "./email";
import { isUniqueViolation, sql } from "./db";
import { hashPassword } from "./passwords";
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
};

function assertAdmin(actor: Actor) {
  if (!actor.isAdmin) throw new AppError("Only an admin can do that.");
}

function assertOwnFlat(actor: Actor, flatId: number) {
  if (!ownsFlat(actor, flatId)) throw new AppError("That flat is not available on this account.");
}

export async function insertFlat(actor: Actor, input: FlatInput): Promise<number> {
  assertAdmin(actor);
  const rows = await sql().query(
    `INSERT INTO flats (unit_number, tenant_name, monthly_rent, rent_start_date, tenant_email, tenant_phone, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.unitNumber,
      input.tenantName,
      input.monthlyRent,
      input.rentStartDate,
      input.tenantEmail,
      input.tenantPhone,
      input.active,
    ],
  );
  return Number((rows[0] as { id: unknown }).id);
}

export async function updateFlat(actor: Actor, id: number, input: FlatInput): Promise<void> {
  assertAdmin(actor);
  const rows = await sql().query(
    `UPDATE flats
     SET unit_number = $1, tenant_name = $2, monthly_rent = $3, rent_start_date = $4,
         tenant_email = $5, tenant_phone = $6, active = $7
     WHERE id = $8
     RETURNING id`,
    [
      input.unitNumber,
      input.tenantName,
      input.monthlyRent,
      input.rentStartDate,
      input.tenantEmail,
      input.tenantPhone,
      input.active,
      id,
    ],
  );
  if (rows.length === 0) throw new AppError("That flat could not be found.");
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
  const blocked = Number(row.payments) + Number(row.adjustments) + Number(row.users);
  if (blocked > 0) {
    throw new AppError(
      "This flat has payments, adjustments, or a linked login, so it cannot be deleted. Mark it inactive instead.",
    );
  }
  const deleted = await sql().query(`DELETE FROM flats WHERE id = $1 RETURNING id`, [id]);
  if (deleted.length === 0) throw new AppError("That flat could not be found.");
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

export async function insertExpense(actor: Actor, input: ExpenseInput): Promise<number> {
  assertAdmin(actor);
  const rows = await sql().query(
    `INSERT INTO expenses (title, category, amount, expense_date, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [input.title, input.category, input.amount, input.expenseDate, input.notes],
  );
  return Number((rows[0] as { id: unknown }).id);
}

export async function updateExpense(actor: Actor, id: number, input: ExpenseInput): Promise<void> {
  assertAdmin(actor);
  const rows = await sql().query(
    `UPDATE expenses
     SET title = $1, category = $2, amount = $3, expense_date = $4, notes = $5
     WHERE id = $6
     RETURNING id`,
    [input.title, input.category, input.amount, input.expenseDate, input.notes, id],
  );
  if (rows.length === 0) throw new AppError("That expense could not be found.");
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
