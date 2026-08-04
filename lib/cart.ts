export interface LineItem {
  sku: string;
  name: string;
  unitCents: number;
  qty: number;
}

export function subtotalCents(items: LineItem[]): number {
  return items.reduce((sum, i) => sum + i.unitCents * i.qty, 0);
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function applyCoupon(cents: number, code: string): number {
  const table: Record<string, number> = { SAVE10: 0.1, SAVE20: 0.2 };
  const pct = table[code] ?? 0;
  return Math.round(cents * (1 - pct));
}
