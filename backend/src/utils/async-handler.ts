import type { NextFunction, Request, Response } from "express";
import { beginAdmittedWork } from "../middlewares/resource-admission";
import { beginTrackedWork } from "./request-work";

export type AsyncRequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    const finishWork = beginTrackedWork(response);
    if (!finishWork) return;
    const finishAdmission = beginAdmittedWork(response);
    if (!finishAdmission) { finishWork(); return; }
    void Promise.resolve().then(() => handler(request, response, next)).catch(next).finally(() => { finishAdmission(); finishWork(); });
  };
}

