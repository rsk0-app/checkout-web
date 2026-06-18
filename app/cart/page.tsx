import { LineItem, subtotalCents, formatUsd } from "../../lib/cart";

const items: LineItem[] = [
  { sku: "TS-01", name: "T-shirt", unitCents: 2500, qty: 2 },
  { sku: "MG-09", name: "Mug", unitCents: 1200, qty: 1 },
];

export default function Cart() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 48 }}>
      <h1>Cart</h1>
      <ul>
        {items.map((i) => (
          <li key={i.sku}>
            {i.name} × {i.qty} — {formatUsd(i.unitCents * i.qty)}
          </li>
        ))}
      </ul>
      <p>
        <strong>Subtotal: {formatUsd(subtotalCents(items))}</strong>
      </p>
    </main>
  );
}
