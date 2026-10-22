// OpenTelemetry helpers used on the request path. Depends only on the OTel API
// packages (no SDK), so they are no-ops until instrumentation.ts starts the SDK.
//
// No PII: spans and logs carry only the HTTP method, a STATIC route, the status
// code and the downstream host. URLs, query strings, headers, bodies and ids are
// never attached (and error messages / exceptions are not recorded).
import { context, propagation, SpanKind, SpanStatusCode, trace, type Context } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

export const SERVICE_NAME = "checkout-web";

/** Error log for a 5xx: fixed message, status code and static route only. */
export function logServerError(ctx: Context, route: string, status: number): void {
  if (status < 500) return;
  try {
    logs.getLogger(SERVICE_NAME).emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: "request failed",
      attributes: { "http.response.status_code": status, "http.route": route },
      context: ctx,
    });
  } catch {
    // telemetry must never affect the request
  }
}

/** Runs `fn` inside a SERVER span; 5xx marks the span as error and emits an error log. */
export async function withServerSpan(
  method: string,
  route: string,
  fn: () => Promise<Response>,
): Promise<Response> {
  return trace.getTracer(SERVICE_NAME).startActiveSpan(
    `${method} ${route}`,
    {
      kind: SpanKind.SERVER,
      attributes: { "http.request.method": method, "http.route": route, "url.path": route },
    },
    async (span) => {
      try {
        const res = await fn();
        span.setAttribute("http.response.status_code", res.status);
        if (res.status >= 500) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          logServerError(context.active(), route, res.status);
        }
        return res;
      } catch (err) {
        span.setAttribute("http.response.status_code", 500);
        span.setStatus({ code: SpanStatusCode.ERROR });
        logServerError(context.active(), route, 500);
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

/** Runs `fn` inside a CLIENT span and hands it W3C trace headers to send downstream. */
export async function withClientSpan<T extends { status: number }>(
  method: string,
  host: string,
  path: string,
  fn: (traceHeaders: Record<string, string>) => Promise<T>,
): Promise<T> {
  return trace.getTracer(SERVICE_NAME).startActiveSpan(
    method,
    {
      kind: SpanKind.CLIENT,
      attributes: { "http.request.method": method, "server.address": host, "url.path": path },
    },
    async (span) => {
      try {
        const headers: Record<string, string> = {};
        propagation.inject(context.active(), headers);
        const res = await fn(headers);
        span.setAttribute("http.response.status_code", res.status);
        if (res.status >= 400) span.setStatus({ code: SpanStatusCode.ERROR });
        return res;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
