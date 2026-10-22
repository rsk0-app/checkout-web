const { test } = require("node:test");
const assert = require("node:assert");

// Nothing listens on this port: the service must still work and not wait on the exporter.
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:1";
process.env.FAILURE_MODE = "errors";
process.env.ERROR_RATE = "1";
process.env.DOWNSTREAM_URL = "";

const { startTelemetry, shutdownTelemetry } = require("../lib/otel-sdk");
startTelemetry(); // real OTLP exporters
const { injectAndRecord } = require("../lib/metrics");

test("serves (including injected 5xx) and shuts down with an unreachable collector", async () => {
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    const res = await injectAndRecord("/api/checkout", () => new Response("ok"), "POST");
    assert.strictEqual(res.status, 500);
  }
  assert.ok(Date.now() - t0 < 2000, "requests must not wait on the exporter");
  await shutdownTelemetry();
});

test("OTEL_SDK_DISABLED=true starts nothing and requests still work", async () => {
  const { spawnSync } = require("node:child_process");
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", `
      const { startTelemetry } = require("./lib/otel-sdk");
      startTelemetry();
      require("./lib/metrics").injectAndRecord("/x", () => new Response("ok")).then((r) => { console.log(r.status); });
    `],
    { env: { ...process.env, OTEL_SDK_DISABLED: "true", FAILURE_MODE: "" }, cwd: require("node:path").join(__dirname, "..") },
  );
  assert.strictEqual(r.stdout.toString().trim(), "200", r.stderr.toString());
});
