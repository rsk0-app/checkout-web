import { checkDownstream } from "../../lib/downstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DEEP readiness probe. Returns 200 only if the downstream /healthz responds 2xx
// within DEP_TIMEOUT_MS (or if no downstream is configured). A downstream outage
// makes this pod NotReady (-> ArgoCD Degraded -> visible cascade) WITHOUT the
// kubelet killing the pod — that stays on the shallow /healthz liveness check.
export async function GET(): Promise<Response> {
  const ready = await checkDownstream();
  const status = ready ? 200 : 503;
  return new Response(
    JSON.stringify({ status: ready ? "ready" : "downstream unavailable" }),
    { status, headers: { "content-type": "application/json" } },
  );
}
