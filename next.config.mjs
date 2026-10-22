/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Keep the OTel SDK and gRPC transport out of the webpack bundle (native-ish deps).
  serverExternalPackages: [
    "@grpc/grpc-js",
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/exporter-trace-otlp-grpc",
    "@opentelemetry/exporter-logs-otlp-grpc",
  ],
};
export default nextConfig;
