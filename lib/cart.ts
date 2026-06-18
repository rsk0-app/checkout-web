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
