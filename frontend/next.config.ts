import type { NextConfig } from "next";
import { developmentOrigins } from "./src/lib/security/development-origins";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: developmentOrigins(process.env.NEXT_DEV_ALLOWED_ORIGINS),
  // Development request URLs, fetch warnings and server-action arguments can
  // contain recovery capabilities. Disable the framework's raw request logger.
  logging: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};

export default nextConfig;
