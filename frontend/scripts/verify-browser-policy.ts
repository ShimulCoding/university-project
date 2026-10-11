import assert from "node:assert/strict";
import { browserPolicy } from "../src/lib/security/browser-policy";

const nonce = Buffer.alloc(24, 7).toString("base64");
const production = browserPolicy(nonce, "https://api.example.invalid/api?synthetic=ignored", false);
assert(production.includes(`'nonce-${nonce}' 'strict-dynamic'`));
assert(!production.includes("'unsafe-eval'"));
assert(!production.match(/script-src [^;]*'unsafe-inline'/));
assert(production.includes("connect-src 'self' https://api.example.invalid;"));
assert(!production.includes("synthetic="));
assert(production.includes("script-src-attr 'none'"));
assert(production.includes("frame-ancestors 'none'"));
assert(production.includes("object-src 'none'"));
assert(!production.includes("upgrade-insecure-requests"));
assert(browserPolicy(nonce, "http://localhost:4000/api", true).includes("'unsafe-eval'"));
assert.throws(() => browserPolicy("client-nonce", "http://localhost:4000", false));
assert.throws(() => browserPolicy(nonce, "javascript:synthetic", false));
assert.throws(() => browserPolicy(nonce, "https://user:synthetic@example.invalid", false));
console.log("Browser policy: 13 construction/negative checks passed.");
