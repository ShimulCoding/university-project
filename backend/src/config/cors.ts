import type { CorsOptions } from "cors";

import { env } from "./env";
import { AppError } from "../utils/app-error";

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Origins sharing a hostname still have different browser trust boundaries.
    // Native/server clients without Origin retain their existing access checks.
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new AppError(403, "Origin is not allowed by CORS."));
  },
  credentials: true,
};
