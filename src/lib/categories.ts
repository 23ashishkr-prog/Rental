export const EXPENSE_CATEGORIES = [
  "Maintenance",
  "Staff",
  "Utilities",
  "Repairs",
  "Tax",
  "Personal",
  "Housekeeping",
  "Other",
] as const;

export function isPersonalCategory(category: string | null | undefined): boolean {
  return (category ?? "").trim().toLowerCase() === "personal";
}
