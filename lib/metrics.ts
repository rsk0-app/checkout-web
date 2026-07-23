// Hand-rolled Prometheus registry. No external dependency on purpose so the
// dependency tree stays unchanged. This module holds process-wide counter
// state, so it MUST run in the Node.js runtime (module-level state is shared
// across route handlers in the same server process). Do not import it from an
// edge/middleware context.

interface CounterEntry {
  route: string;
  code: string;
  count: number;
}

// key = `${route}\u0000${code}`
const requestCounters = new Map<string, CounterEntry>();

interface DurationEntry {
  route: string;
  sum: number; // seconds
  count: number;
}

// key = route
const durations = new Map<string, DurationEntry>();

export function record(route: string, code: number | string, durationSec: number): void {
  const codeStr = String(code);
  const cKey = `${route}\u0000${codeStr}`;
  const existing = requestCounters.get(cKey);
  if (existing) {
    existing.count += 1;
  } else {
    requestCounters.set(cKey, { route, code: codeStr, count: 1 });
  }

  const d = durations.get(route);
  if (d) {
    d.sum += durationSec;
    d.count += 1;
  } else {
    durations.set(route, { route, sum: durationSec, count: 1 });
  }
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

export function renderMetrics(): string {
  const lines: string[] = [];

  lines.push("# HELP http_requests_total Total HTTP requests processed.");
  lines.push("# TYPE http_requests_total counter");
  for (const e of requestCounters.values()) {
    lines.push(
      `http_requests_total{route="${escapeLabel(e.route)}",code="${escapeLabel(e.code)}"} ${e.count}`,
    );
  }

  lines.push("# HELP http_request_duration_seconds Request duration in seconds.");
  lines.push("# TYPE http_request_duration_seconds summary");
  for (const d of durations.values()) {
    const route = escapeLabel(d.route);
    lines.push(`http_request_duration_seconds_sum{route="${route}"} ${d.sum}`);
    lines.push(`http_request_duration_seconds_count{route="${route}"} ${d.count}`);
  }

  return lines.join("\n") + "\n";
}

export interface FailureConfig {
  mode: string;
  errorRate: number;
  latencyMs: number;
}

export function failureConfig(): FailureConfig {
  const mode = process.env.FAILURE_MODE ?? "";
  const errorRate = Number.parseFloat(process.env.ERROR_RATE ?? "");
  const latencyMs = Number.parseInt(process.env.LATENCY_MS ?? "", 10);
  return {
    mode,
    errorRate: Number.isFinite(errorRate) ? errorRate : 0.5,
    latencyMs: Number.isFinite(latencyMs) ? latencyMs : 1500,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wrap a unit of work with failure injection + metrics recording.
export async function injectAndRecord(
  route: string,
  work: () => Response | Promise<Response>,
): Promise<Response> {
  const cfg = failureConfig();
  const start = Date.now();

  if (cfg.mode === "errors" && Math.random() < cfg.errorRate) {
    record(route, 500, (Date.now() - start) / 1000);
    return new Response("injected failure", { status: 500 });
  }

  if (cfg.mode === "latency") {
    await sleep(cfg.latencyMs);
  }

  const res = await work();
  record(route, res.status, (Date.now() - start) / 1000);
  return res;
}

let crashScheduled = false;

// If FAILURE_MODE === "crash", schedule a hard process exit so the container
// dies and k8s restarts/crashloops it. Idempotent: only schedules once.
export function maybeCrash(): void {
  if (crashScheduled) return;
  if ((process.env.FAILURE_MODE ?? "") !== "crash") return;
  crashScheduled = true;
  const afterSec = Number.parseInt(process.env.CRASH_AFTER_SEC ?? "", 10);
  const delay = (Number.isFinite(afterSec) ? afterSec : 3) * 1000;
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error("FAILURE_MODE=crash: exiting process");
    process.exit(1);
  }, delay);
}
