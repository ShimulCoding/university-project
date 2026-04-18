import type { CorsOptions } from "cors";

import { env } from "./env";

const localDevelopmentOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const isConfiguredOrigin = !origin || env.corsOrigins.includes(origin);
    const isAllowedLocalDevelopmentOrigin =
      env.NODE_ENV !== "production" &&
      Boolean(origin) &&
      localDevelopmentOriginPattern.test(origin);

    if (isConfiguredOrigin || isAllowedLocalDevelopmentOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true,
};
