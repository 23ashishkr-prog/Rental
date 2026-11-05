export function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function notice(value: string | string[] | undefined): string | null {
  const text = one(value)?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, 240);
}
