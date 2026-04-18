import type { CorsOptions } from "cors";

import { env } from "./env";

// Only allow known development ports (frontend: 3000, backend: 4000) instead
// of any localhost port, to prevent cookie theft via port-sharing attacks.
const localDevelopmentOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1):(3000|4000)$/;

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const isConfiguredOrigin = !origin || env.corsOrigins.includes(origin);
    const isAllowedLocalDevelopmentOrigin =
      env.NODE_ENV !== "production" &&
      typeof origin === "string" &&
      localDevelopmentOriginPattern.test(origin);

    if (isConfiguredOrigin || isAllowedLocalDevelopmentOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true,
};
