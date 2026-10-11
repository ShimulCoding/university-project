import { NextRequest, NextResponse } from "next/server";
import { browserPolicy } from "./lib/security/browser-policy";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64");
  const policy = browserPolicy(nonce, process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api", process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  // Override client-supplied policy/nonce. Next extracts the nonce from the
  // trusted request CSP when rendering its framework and streamed scripts.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  // A nonce-bearing HTML document must never be reused by a shared cache.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
