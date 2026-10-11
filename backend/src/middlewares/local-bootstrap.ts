import type { RequestHandler } from "express";
import { env } from "../config/env";

export function permitsLocalBootstrap(input: { enabled: boolean; production: boolean; remoteAddress?: string | undefined; browserOrigin?: string | undefined; forwarded?: string | undefined; forwardedFor?: string | undefined; realIp?: string | undefined }) {
  return input.enabled && !input.production &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(input.remoteAddress ?? "") &&
    !input.browserOrigin && !input.forwarded && !input.forwardedFor && !input.realIp;
}

// Initial admin creation is an explicit local operator action. Use the socket
// address, never the potentially proxy-derived request.ip. Browsers and proxy
// forwarded requests cannot use this endpoint.
export const requireLocalBootstrap: RequestHandler = (request, response, next) => {
  if (!permitsLocalBootstrap({ enabled: env.ENABLE_LOCAL_ADMIN_BOOTSTRAP === "true", production: env.NODE_ENV === "production", remoteAddress: request.socket.remoteAddress, browserOrigin: request.get("origin"), forwarded: request.get("forwarded"), forwardedFor: request.get("x-forwarded-for"), realIp: request.get("x-real-ip") })) {
    response.status(404).json({ message: "Not found." }); return;
  }
  next();
};
