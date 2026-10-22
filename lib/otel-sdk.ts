// OpenTelemetry SDK bootstrap: traces + error logs over OTLP gRPC.
//
// Defaults to otel-collector.rsk0-telemetry.svc:4317 (override with
// OTEL_EXPORTER_OTLP_ENDPOINT; disable with OTEL_SDK_DISABLED=true). Exporters are
// asynchronous and batched, so an unset/unreachable collector drops telemetry but
// never blocks or fails a request. Only this service's own SERVER/CLIENT spans are
// exported; Next.js internal spans (which carry full URLs) are dropped.
import { Resource } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  type ReadableSpan,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { BatchLogRecordProcessor, LoggerProvider, type LogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { logs } from "@opentelemetry/api-logs";
import { SERVICE_NAME } from "./otel-api";

const DEFAULT_ENDPOINT = "http://otel-collector.rsk0-telemetry.svc:4317";

/** Forwards only this service's own spans (instrumentation scope === service name). */
class OwnSpansOnly implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}
  onStart(): void {}
  onEnd(span: ReadableSpan): void {
    if (span.instrumentationLibrary.name === SERVICE_NAME) this.inner.onEnd(span);
  }
  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
  forceFlush(): Promise<void> {
    return this.inner.forceFlush();
  }
}

export interface TelemetryOptions {
  /** Tests inject in-memory processors; the OTLP exporters are then not created. */
  spanProcessor?: SpanProcessor;
  logProcessor?: LogRecordProcessor;
}

let shutdownFn: (() => Promise<void>) | undefined;

export function startTelemetry(opts: TelemetryOptions = {}): void {
  if ((process.env.OTEL_SDK_DISABLED ?? "").toLowerCase() === "true" || shutdownFn) return;
  try {
    const attrs: Record<string, string> = { "service.name": SERVICE_NAME };
    if (process.env.K8S_NAMESPACE) attrs["k8s.namespace.name"] = process.env.K8S_NAMESPACE;
    const resource = new Resource(attrs);
    const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? undefined : DEFAULT_ENDPOINT;

    const spanProc =
      opts.spanProcessor ?? new BatchSpanProcessor(new OTLPTraceExporter({ url, timeoutMillis: 3000 }));
    const tp = new NodeTracerProvider({ resource, spanProcessors: [new OwnSpansOnly(spanProc)] });
    tp.register();

    const lp = new LoggerProvider({ resource });
    lp.addLogRecordProcessor(
      opts.logProcessor ?? new BatchLogRecordProcessor(new OTLPLogExporter({ url, timeoutMillis: 3000 })),
    );
    logs.setGlobalLoggerProvider(lp);

    shutdownFn = async () => {
      await Promise.allSettled([tp.shutdown(), lp.shutdown()]);
    };
  } catch (err) {
    // Telemetry must never stop the service.
    // eslint-disable-next-line no-console
    console.error("checkout-web: telemetry disabled:", (err as Error).message);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  const fn = shutdownFn;
  shutdownFn = undefined;
  if (fn) await Promise.race([fn(), new Promise((r) => setTimeout(r, 3000).unref())]);
}
