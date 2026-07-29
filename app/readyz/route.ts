import { checkDownstream } from "../../lib/downstream";
import { dbHealthy } from "../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DEEP readiness probe. R2: returns 200 only if BOTH (a) the DB check (SELECT 1)
// succeeds AND (b) the downstream /readyz responds 2xx within DEP_TIMEOUT_MS (or
// no downstream configured). Either failing => 503: a broken DB or a downstream
// outage makes this pod NotReady (-> ArgoCD Degraded -> the cascade propagates up
// the chain) WITHOUT the kubelet killing the pod — that stays on shallow /healthz.
export async function GET(): Promise<Response> {
  const [dbOk, downstreamOk] = await Promise.all([dbHealthy(), checkDownstream()]);
  if (!dbOk) {
    return new Response(JSON.stringify({ status: "db unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  const status = downstreamOk ? 200 : 503;
  return new Response(
    JSON.stringify({ status: downstreamOk ? "ready" : "downstream unavailable" }),
    { status, headers: { "content-type": "application/json" } },
  );
}
