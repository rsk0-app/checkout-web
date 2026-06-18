const { test } = require("node:test");
const assert = require("node:assert");

function subtotalCents(items) {
  return items.reduce((s, i) => s + i.unitCents * i.qty, 0);
}
function formatUsd(c) { return `$${(c / 100).toFixed(2)}`; }

test("subtotal sums line items", () => {
  assert.strictEqual(subtotalCents([{ unitCents: 2500, qty: 2 }, { unitCents: 1200, qty: 1 }]), 6200);
});
test("usd formatting", () => {
  assert.strictEqual(formatUsd(6200), "$62.00");
});
