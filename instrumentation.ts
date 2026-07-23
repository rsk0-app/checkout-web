// Next.js runs this once at server startup (Node.js runtime). Used here to
// arm the FAILURE_MODE=crash injector so the process self-exits and k8s
// crashloops it.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { maybeCrash } = await import("./lib/metrics");
    maybeCrash();
  }
}
