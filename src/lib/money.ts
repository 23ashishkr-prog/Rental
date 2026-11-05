export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function toPaise(value: number): number {
  return Math.round(value * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function formatINR(value: number): string {
  const amount = roundMoney(value);
  const hasPaise = Math.abs(amount % 1) > 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatINRPlain(value: number): string {
  return formatINR(value).replace(/\u00a0/g, " ");
}
