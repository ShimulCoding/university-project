import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import path from "node:path";
import nextConfig from "../next.config";

// Exercise this project's installed Next logger with synthetic capabilities.
// Never run an actual reset or forward browser/private account values to stdout.
const requireNext = createRequire(path.resolve(process.cwd(), "package.json"));
const { default: DevServer } = requireNext("next/dist/server/dev/next-dev-server.js");
const { setRequestMeta } = requireNext("next/dist/server/request-meta.js");
const marker = "synthetic-framework-private-value";
const request = { method: "GET", url: `/reset-password?token=${marker}`, fetchMetrics: [
  { url: `https://example.invalid/api?token=${marker}`, method: "GET", status: 200, start: 0, end: 10, cacheStatus: "miss", cacheWarning: marker },
] };
setRequestMeta(request, { match: { definition: { pathname: "/reset-password" } }, devServerActionLog: { functionName: "syntheticAction", args: [marker], duration: 1, location: "synthetic.ts:1" } });
const parent = Object.getPrototypeOf(DevServer.prototype);
const parentDescriptor = Object.getOwnPropertyDescriptor(parent, "getRequestHandler");
let handled = 0;
parent.getRequestHandler = () => () => { handled++; };
function exercise(logging: typeof nextConfig.logging) {
  const response = { statusCode: 200, originalResponse: new EventEmitter() };
  const server = { nextConfig: { logging }, normalizeReq: (value: unknown) => value, normalizeRes: (value: unknown) => value };
  DevServer.prototype.getRequestHandler.call(server)(request, response, {});
  response.originalResponse.emit("close");
}
const write = process.stdout.write;
let captured = "";
process.stdout.write = ((chunk: string | Uint8Array) => { captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(); return true; }) as typeof write;
try {
  exercise(nextConfig.logging);
  assert.equal(captured, "", "Framework logging disclosed a request URL or private action argument");
  assert.equal(nextConfig.logging, false, "Raw framework logging was enabled");
  assert.equal(handled, 1, "Logging policy prevented legitimate request handling");
  // Negative control: prove the installed framework/harness actually reaches
  // the baseline leak rather than silently skipping an unsupported API.
  exercise(undefined);
  assert(captured.includes(marker), "Logger negative control did not reproduce raw URL output");
  assert(captured.includes("syntheticAction"), "Server-action argument path was not exercised");
} finally {
  process.stdout.write = write;
  if (parentDescriptor) Object.defineProperty(parent, "getRequestHandler", parentDescriptor);
  else delete parent.getRequestHandler;
}
console.log("Next framework logging: 5 synthetic privacy/configuration/request/negative-control checks passed.");
