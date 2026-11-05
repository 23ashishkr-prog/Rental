import "server-only";
import { ConfigError } from "./errors";
import { gmailLocalPart, isAdminEmail } from "./email";
import { asDate, asNumber, asText, isUndefinedColumn, sql } from "./db";
import type {
  Actor,
  AdjustmentRecord,
  DbUser,
  ExpenseRecord,
  FlatRecord,
  PaymentRecord,
  PaymentStatus,
} from "./types";

type Row = Record<string, unknown>;

const MIGRATION_MESSAGE =
  "The database is missing app_users.password_hash. Run migrations/001_app_users_password.sql in the Neon SQL editor, then sign in again.";

function failMigration(error: unknown): never {
  if (isUndefinedColumn(error)) throw new ConfigError(MIGRATION_MESSAGE);
  throw error;
}

function likePattern(value: string): string {
  return `%${value.trim().replace(/[\\%_]/g, "\\$&")}%`;
}

function mapUser(row: Row): DbUser {
  const email = String(row.email ?? "");
  const isAdmin = row.role === "admin" || isAdminEmail(email);
  return {
    id: Number(row.id),
    email,
    name: asText(row.name),
    role: isAdmin ? "admin" : "tenant",
    flatId: row.flat_id == null ? null : Number(row.flat_id),
    passwordHash: row.password_hash == null ? null : String(row.password_hash),
    isAdmin,
  };
}

function mapFlat(row: Row): FlatRecord {
  return {
    id: Number(row.id),
    unitNumber: String(row.unit_number ?? ""),
    tenantName: asText(row.tenant_name),
    monthlyRent: asNumber(row.monthly_rent),
    rentStartDate: asDate(row.rent_start_date),
    tenantEmail: asText(row.tenant_email),
    tenantPhone: asText(row.tenant_phone),
    active: row.active !== false && row.active !== "f" && row.active !== "false",
    createdAt: String(row.created_at ?? ""),
  };
}

function mapStatus(value: unknown): PaymentStatus {
  if (value === "pending" || value === "rejected") return value;
  return "confirmed";
}

function mapPayment(row: Row): PaymentRecord {
  return {
    id: Number(row.id),
    flatId: Number(row.flat_id),
    unitNumber: String(row.unit_number ?? ""),
    tenantName: asText(row.tenant_name),
    paymentDate: asDate(row.payment_date) ?? "",
    amount: asNumber(row.amount),
    notes: asText(row.notes),
    forMonth: asDate(row.for_month),
    method: asText(row.method),
    upiRef: asText(row.upi_ref),
    status: mapStatus(row.status),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapExpense(row: Row): ExpenseRecord {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    category: asText(row.category),
    amount: asNumber(row.amount),
    expenseDate: asDate(row.expense_date) ?? "",
    notes: asText(row.notes),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapAdjustment(row: Row): AdjustmentRecord {
  return {
    id: Number(row.id),
    flatId: Number(row.flat_id),
    month: asDate(row.month) ?? "",
    amount: asNumber(row.amount),
    reason: asText(row.reason),
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdAt: String(row.created_at ?? ""),
  };
}

const USER_COLUMNS = "id, email, name, role, flat_id, password_hash";

export async function findUserById(id: number): Promise<DbUser | null> {
  try {
    const rows = await sql().query(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1`, [id]);
    const row = rows[0] as Row | undefined;
    return row ? mapUser(row) : null;
  } catch (error) {
    failMigration(error);
  }
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const exact = email.trim().toLowerCase();
  const local = gmailLocalPart(email);
  try {
    const rows = await sql().query(
      `SELECT ${USER_COLUMNS}
       FROM app_users
       WHERE lower(trim(email)) = $1
          OR (
            $2::text IS NOT NULL
            AND lower(split_part(trim(email), '@', 2)) IN ('gmail.com', 'googlemail.com')
            AND replace(lower(split_part(trim(email), '@', 1)), '.', '') = $2
          )
       ORDER BY CASE WHEN lower(trim(email)) = $1 THEN 0 ELSE 1 END, id
       LIMIT 1`,
      [exact, local],
    );
    const row = rows[0] as Row | undefined;
    return row ? mapUser(row) : null;
  } catch (error) {
    failMigration(error);
  }
}

export async function flatIdsForUser(user: { email: string; flatId: number | null }): Promise<number[]> {
  const exact = user.email.trim().toLowerCase();
  const local = gmailLocalPart(user.email);
  const rows = await sql().query(
    `SELECT id
     FROM flats
     WHERE ($1::bigint IS NOT NULL AND id = $1::bigint)
        OR (
          tenant_email IS NOT NULL AND (
            lower(trim(tenant_email)) = $2
            OR (
              $3::text IS NOT NULL
              AND lower(split_part(trim(tenant_email), '@', 2)) IN ('gmail.com', 'googlemail.com')
              AND replace(lower(split_part(trim(tenant_email), '@', 1)), '.', '') = $3
            )
          )
        )`,
    [user.flatId, exact, local],
  );
  return [...new Set(rows.map((row) => Number((row as Row).id)))];
}

export async function queryFlats(
  actor: Actor,
  opts: { q?: string; flatId?: number; active?: "active" | "inactive" | "all" } = {},
): Promise<FlatRecord[]> {
  const params: unknown[] = [];
  const where: string[] = [];

  if (!actor.isAdmin) {
    if (actor.flatIds.length === 0) return [];
    params.push(actor.flatIds);
    where.push(`id = ANY($${params.length}::bigint[])`);
  }
  if (opts.flatId) {
    params.push(opts.flatId);
    where.push(`id = $${params.length}`);
  }
  if (opts.active === "inactive") where.push("active = false");
  else if (opts.active !== "all") where.push("active = true");

  if (opts.q?.trim()) {
    params.push(likePattern(opts.q));
    const token = `$${params.length}`;
    where.push(
      `(unit_number ILIKE ${token} ESCAPE '\\' OR coalesce(tenant_name, '') ILIKE ${token} ESCAPE '\\' OR coalesce(tenant_email, '') ILIKE ${token} ESCAPE '\\' OR coalesce(tenant_phone, '') ILIKE ${token} ESCAPE '\\')`,
    );
  }

  const rows = await sql().query(
    `SELECT id, unit_number, tenant_name, monthly_rent, rent_start_date, tenant_email, tenant_phone, active, created_at
     FROM flats
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY id`,
    params,
  );
  return (rows as Row[])
    .map(mapFlat)
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, "en", { numeric: true }) || a.id - b.id);
}

export async function queryPayments(
  actor: Actor,
  opts: {
    id?: number;
    flatId?: number;
    flatIds?: number[];
    status?: string;
    month?: string;
    q?: string;
    limit?: number | null;
  } = {},
): Promise<PaymentRecord[]> {
  const params: unknown[] = [];
  const where: string[] = [];

  if (!actor.isAdmin) {
    if (actor.flatIds.length === 0) return [];
    params.push(actor.flatIds);
    where.push(`p.flat_id = ANY($${params.length}::bigint[])`);
  }
  if (opts.flatIds) {
    const ids = actor.isAdmin ? opts.flatIds : opts.flatIds.filter((id) => actor.flatIds.includes(id));
    if (ids.length === 0) return [];
    params.push(ids);
    where.push(`p.flat_id = ANY($${params.length}::bigint[])`);
  }
  if (opts.id) {
    params.push(opts.id);
    where.push(`p.id = $${params.length}`);
  }
  if (opts.flatId) {
    params.push(opts.flatId);
    where.push(`p.flat_id = $${params.length}`);
  }
  if (opts.status && opts.status !== "all") {
    params.push(opts.status);
    where.push(`p.status = $${params.length}`);
  }
  if (opts.month) {
    params.push(opts.month.slice(0, 7));
    where.push(
      `(to_char(p.payment_date, 'YYYY-MM') = $${params.length} OR to_char(p.for_month, 'YYYY-MM') = $${params.length})`,
    );
  }
  if (opts.q?.trim()) {
    params.push(likePattern(opts.q));
    const token = `$${params.length}`;
    where.push(
      `(f.unit_number ILIKE ${token} ESCAPE '\\' OR coalesce(f.tenant_name, '') ILIKE ${token} ESCAPE '\\' OR coalesce(p.upi_ref, '') ILIKE ${token} ESCAPE '\\' OR coalesce(p.notes, '') ILIKE ${token} ESCAPE '\\' OR coalesce(p.method, '') ILIKE ${token} ESCAPE '\\')`,
    );
  }

  const limited = opts.limit !== null;
  if (limited) params.push(opts.limit ?? 400);
  const rows = await sql().query(
    `SELECT p.id, p.flat_id, p.payment_date, p.amount, p.notes, p.for_month, p.method, p.upi_ref, p.status, p.created_at,
            f.unit_number, f.tenant_name
     FROM payments p
     JOIN flats f ON f.id = p.flat_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY p.payment_date DESC, p.id DESC
     ${limited ? `LIMIT $${params.length}` : ""}`,
    params,
  );
  return (rows as Row[]).map(mapPayment);
}

export async function queryAdjustments(actor: Actor, flatIds: number[]): Promise<AdjustmentRecord[]> {
  const ids = actor.isAdmin ? flatIds : flatIds.filter((id) => actor.flatIds.includes(id));
  if (ids.length === 0) return [];
  const rows = await sql().query(
    `SELECT id, flat_id, month, amount, reason, created_by, created_at
     FROM rent_adjustments
     WHERE flat_id = ANY($1::bigint[])
     ORDER BY month DESC, id DESC`,
    [ids],
  );
  return (rows as Row[]).map(mapAdjustment);
}

export async function queryExpenses(
  actor: Actor,
  opts: { month?: string; q?: string; id?: number } = {},
): Promise<ExpenseRecord[]> {
  if (!actor.isAdmin) return [];
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts.id) {
    params.push(opts.id);
    where.push(`id = $${params.length}`);
  }
  if (opts.month) {
    params.push(opts.month.slice(0, 7));
    where.push(`to_char(expense_date, 'YYYY-MM') = $${params.length}`);
  }
  if (opts.q?.trim()) {
    params.push(likePattern(opts.q));
    const token = `$${params.length}`;
    where.push(
      `(title ILIKE ${token} ESCAPE '\\' OR coalesce(category, '') ILIKE ${token} ESCAPE '\\' OR coalesce(notes, '') ILIKE ${token} ESCAPE '\\')`,
    );
  }
  const rows = await sql().query(
    `SELECT id, title, category, amount, expense_date, notes, created_at
     FROM expenses
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY expense_date DESC, id DESC
     LIMIT 400`,
    params,
  );
  return (rows as Row[]).map(mapExpense);
}

export async function countPendingPayments(actor: Actor): Promise<number> {
  if (!actor.isAdmin) {
    if (actor.flatIds.length === 0) return 0;
    const rows = await sql().query(
      `SELECT count(*) AS n FROM payments WHERE status = 'pending' AND flat_id = ANY($1::bigint[])`,
      [actor.flatIds],
    );
    return Number((rows[0] as Row | undefined)?.n ?? 0);
  }
  const rows = await sql().query(`SELECT count(*) AS n FROM payments WHERE status = 'pending'`);
  return Number((rows[0] as Row | undefined)?.n ?? 0);
}
