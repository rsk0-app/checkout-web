const { test, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

process.env.FAILURE_MODE = "errors"; // existing knob: genuine injected 5xx
process.env.ERROR_RATE = "1";
process.env.DOWNSTREAM_URL = "";
process.env.K8S_NAMESPACE = "prod";

const { SimpleSpanProcessor, InMemorySpanExporter } = require("@opentelemetry/sdk-trace-node");
const { SimpleLogRecordProcessor, InMemoryLogRecordExporter } = require("@opentelemetry/sdk-logs");
const { SpanKind, SpanStatusCode, trace } = require("@opentelemetry/api");
const { SeverityNumber } = require("@opentelemetry/api-logs");

const spans = new InMemorySpanExporter();
const logRecords = new InMemoryLogRecordExporter();
require("../lib/otel-sdk").startTelemetry({
  spanProcessor: new SimpleSpanProcessor(spans),
  logProcessor: new SimpleLogRecordProcessor(logRecords),
});
const { injectAndRecord } = require("../lib/metrics");
const { checkDownstream } = require("../lib/downstream");

test("5xx produces an error-level log record and an error SERVER span, without PII", async () => {
  const res = await injectAndRecord("/api/checkout", () => new Response("ok"), "POST");
  assert.strictEqual(res.status, 500);

  const serverSpans = spans.getFinishedSpans().filter((s) => s.kind === SpanKind.SERVER);
  assert.strictEqual(serverSpans.length, 1);
  assert.strictEqual(serverSpans[0].name, "POST /api/checkout");
  assert.strictEqual(serverSpans[0].status.code, SpanStatusCode.ERROR);
  assert.strictEqual(serverSpans[0].resource.attributes["service.name"], "checkout-web");
  assert.strictEqual(serverSpans[0].resource.attributes["k8s.namespace.name"], "prod");

  const recs = logRecords.getFinishedLogRecords();
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].severityNumber, SeverityNumber.ERROR);
  assert.strictEqual(recs[0].body, "request failed");
  assert.strictEqual(recs[0].attributes["http.response.status_code"], 500);
  assert.strictEqual(recs[0].spanContext.traceId, serverSpans[0].spanContext().traceId);
  assert.deepStrictEqual(Object.keys(recs[0].attributes).sort(), ["http.response.status_code", "http.route"]);
});

test("Next.js internal spans are not exported", () => {
  spans.reset();
  trace.getTracer("next.js").startSpan("internal").end();
  assert.strictEqual(spans.getFinishedSpans().length, 0);
});

test("outgoing call produces a CLIENT span and propagates trace context", async () => {
  process.env.FAILURE_MODE = "";
  spans.reset();
  let traceparent;
  const srv = http.createServer((req, res) => {
    traceparent = req.headers.traceparent;
    res.end("ok");
  });
  await new Promise((r) => srv.listen(0, r));
  after(() => srv.close());
  process.env.DOWNSTREAM_URL = `http://127.0.0.1:${srv.address().port}`;

  const res = await injectAndRecord("/api/checkout", () => new Response("ok"), "GET");
  assert.strictEqual(res.status, 200);
  const client = spans.getFinishedSpans().filter((s) => s.kind === SpanKind.CLIENT);
  assert.strictEqual(client.length, 1);
  assert.ok(traceparent && traceparent.includes(client[0].spanContext().spanId), "traceparent carries the client span");
  assert.deepStrictEqual(
    Object.keys(client[0].attributes).sort(),
    ["http.request.method", "http.response.status_code", "server.address", "url.path"],
  );
  assert.strictEqual(await checkDownstream(), true);
});
