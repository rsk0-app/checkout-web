import { renderMetrics } from "../../lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prometheus scrape endpoint. NOT failure-injected.
export function GET(): Response {
  return new Response(renderMetrics(), {
    status: 200,
    headers: { "content-type": "text/plain; version=0.0.4" },
  });
}
