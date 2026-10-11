// Only operator configuration contributes origins; never interpolate a request
// header into CSP. URL.origin strips paths/query text from valid HTTP(S) URLs.
export function browserPolicy(nonce: string, apiBase: string, development: boolean) {
  if (!/^[A-Za-z0-9+/]{32}$/.test(nonce)) throw new Error("Invalid server nonce.");
  const api = new URL(apiBase);
  if (!["https:", "http:"].includes(api.protocol) || api.username || api.password) {
    throw new Error("API base must be an HTTP(S) URL without credentials.");
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // Existing chart geometry and React controls use inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${api.origin}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
