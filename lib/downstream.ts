// R1 (realistic-stand): real dependency call for blast-radius.
//
// On every BUSINESS request this service calls its downstream's /healthz. If the
// downstream is unhealthy (non-2xx), times out, or errors, the caller reports a
// 502 — so a downstream failure cascades UP the chain instead of being masked.
//
// DOWNSTREAM_URL empty => no dependency wired; skip the call (behave as before).
// DEP_TIMEOUT_MS bounds the call so a slow/hung downstream fails fast and never
// pins a request thread.

export function downstreamUrl(): string {
  return (process.env.DOWNSTREAM_URL ?? "").trim();
}

export function depTimeoutMs(): number {
  const ms = Number.parseInt(process.env.DEP_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(ms) && ms > 0 ? ms : 800;
}

// Returns true when the downstream /readyz responds 2xx within the timeout, or
// when no downstream is configured. Never throws — all failures collapse to false.
//
// We check the downstream's DEEP /readyz (not shallow /healthz) so readiness
// CHAINS: if payments is down, orders /readyz goes 503, which makes checkout
// /readyz go 503 too — the cascade propagates ALL the way up the chain, not one
// hop. The leaf (payments) serves /readyz shallowly (ready == process up).
export async function checkDownstream(): Promise<boolean> {
  const base = downstreamUrl();
  if (base === "") return true; // no dependency configured — skip

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), depTimeoutMs());
  try {
    const res = await fetch(`${base}/readyz`, {
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok; // 2xx only
  } catch {
    return false; // timeout / network / DNS / abort — all cascade as failure
  } finally {
    clearTimeout(timer);
  }
}
