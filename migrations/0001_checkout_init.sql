-- baseline: checkout-web owns the checkouts table (R2 realistic-stand).
CREATE TABLE IF NOT EXISTS checkouts (
  id           text PRIMARY KEY,
  amount_cents integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
