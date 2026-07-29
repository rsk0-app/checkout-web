import { injectAndRecord } from "../../../lib/metrics";
import { dbEnabled, dbCreateCheckout } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The main business path. injectAndRecord() runs the R1 downstream check first
// (502 cascade if orders-service is unhealthy); the work below then does a REAL
// DB write+read against the checkouts table when a DB is configured. A DB error
// surfaces as a real 500 (so a broken schema is a real failure). DATABASE_URL
// empty => no-DB response (local fallback).
function handle(): Promise<Response> {
  return injectAndRecord("/api/checkout", async () => {
    if (dbEnabled()) {
      try {
        const checkout = await dbCreateCheckout(1999);
        return new Response(JSON.stringify({ ok: true, checkout }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "checkout persistence failed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

export function GET(): Promise<Response> {
  return handle();
}

export function POST(): Promise<Response> {
  return handle();
}
