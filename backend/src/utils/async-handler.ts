import type { NextFunction, Request, Response } from "express";
import { beginAdmittedWork } from "../middlewares/resource-admission";

export type AsyncRequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    const finish = beginAdmittedWork(response);
    if (!finish) return;
    void Promise.resolve().then(() => handler(request, response, next)).catch(next).finally(finish);
  };
}

