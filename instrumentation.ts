// Next.js runs this once at server startup (Node.js runtime). Used here to:
//  - R2: apply DB migrations before serving. A failing migration process.exit(1)s
//    so a bad migration really breaks the deploy (the modeled risk).
//  - arm the FAILURE_MODE=crash injector so the process self-exits (k8s crashloop).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./lib/db");
    try {
      await runMigrations();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("checkout-web: startup failed (migrations):", err);
      process.exit(1);
    }
    const { maybeCrash } = await import("./lib/metrics");
    maybeCrash();
  }
}
