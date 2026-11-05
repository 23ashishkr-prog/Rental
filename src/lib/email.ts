const ADMIN_EMAILS = new Set([
  normalizeEmail("sudi.chandra@gmail.com"),
  normalizeEmail("23.ashish.kr@gmail.com"),
]);

/** Lower-case compare. Gmail and googlemail ignore dots; plus-tags stay distinct. */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}

/** Dot-stripped gmail local part, or null when the address is not gmail. */
export function gmailLocalPart(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || normalized.slice(at + 1) !== "gmail.com") return null;
  return normalized.slice(0, at);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
