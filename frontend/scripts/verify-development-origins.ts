import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { developmentOrigins } from "../src/lib/security/development-origins";

let checks = 0;
function check(action: () => void) { action(); checks++; }
check(() => assert.deepEqual(developmentOrigins(undefined), []));
check(() => assert.deepEqual(developmentOrigins(""), []));
check(() => assert.deepEqual(developmentOrigins(" LOCALHOST, 192.0.2.20,localhost, "), ["localhost", "192.0.2.20"]));
check(() => assert.deepEqual(developmentOrigins("127.0.0.1,dev.example.invalid,[::1]"), ["127.0.0.1", "dev.example.invalid", "[::1]"]));
for (const value of ["*", "*.example.invalid", "https://example.invalid", "example.invalid:3000", "user:secret@example.invalid", "example.invalid/path", "example.invalid?value=1", "example.invalid#fragment", "example.invalid\\path", "192.000.2.20"]) {
  check(() => assert.throws(() => developmentOrigins(value)));
}
// Exercise the installed framework's real development gate. Capture its warning
// output; no credentials or user requests are passed into this fixture.
const requireNext = createRequire(path.resolve(process.cwd(), "package.json"));
const { blockCrossSiteDEV } = requireNext("next/dist/server/lib/router-utils/block-cross-site-dev.js");
const originalWarn = console.warn; console.warn = () => {};
try {
  function gate(origin: string, allowed: string[]) {
    let ended = false;
    const response = { statusCode: 200, end: () => { ended = true; } };
    const denied = blockCrossSiteDEV({ url: "/_next/hmr", headers: { origin } }, response, allowed, "localhost");
    return { denied, status: response.statusCode, ended };
  }
  check(() => assert.deepEqual(gate("http://192.0.2.20:3000", []), { denied: true, status: 403, ended: true }));
  check(() => assert.deepEqual(gate("http://192.0.2.20:3000", developmentOrigins("192.0.2.20")), { denied: false, status: 200, ended: false }));
  check(() => assert.deepEqual(gate("http://hostile.example.invalid", developmentOrigins("192.0.2.20")), { denied: true, status: 403, ended: true }));
  check(() => assert.deepEqual(gate("null", developmentOrigins("192.0.2.20")), { denied: true, status: 403, ended: true }));
  check(() => assert.deepEqual(gate("http://localhost:3000", []), { denied: false, status: 200, ended: false }));
} finally { console.warn = originalWarn; }
console.log(`Development origins: ${checks} parsing and installed-framework allow/deny checks passed.`);
