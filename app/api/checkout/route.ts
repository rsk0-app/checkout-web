import { injectAndRecord } from "../../../lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handle(): Promise<Response> {
  return injectAndRecord(
    "/api/checkout",
    () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

export function GET(): Promise<Response> {
  return handle();
}

export function POST(): Promise<Response> {
  return handle();
}
