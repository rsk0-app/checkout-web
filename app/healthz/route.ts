export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// k8s liveness/readiness probe target. NOT failure-injected.
export function GET(): Response {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
