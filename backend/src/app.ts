import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { corsOptions } from "./config/cors";
import { env } from "./config/env";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";
import { apiRouter } from "./routes";
import { requestLogger, requestReference } from "./utils/security-logging";
import { bindRequestWork, readinessHandler, RequestWork } from "./utils/request-work";

export function createApp(work = new RequestWork()) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY_HOPS || false);

  app.use(requestReference);
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors(corsOptions));
  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "mu-cse-transparency-backend",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/readyz", readinessHandler(work));
  app.use(bindRequestWork(work));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
