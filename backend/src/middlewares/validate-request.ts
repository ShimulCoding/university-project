import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";

function replaceRequestValue(
  request: Request,
  key: "body" | "params" | "query",
  value: unknown,
) {
  if (value === undefined) {
    return;
  }

  Object.defineProperty(request, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export function validateRequest(schema: AnyZodObject) {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      const parsedRequest = schema.parse({
        body: request.body,
        params: request.params,
        query: request.query,
      });

      replaceRequestValue(request, "body", parsedRequest.body);
      replaceRequestValue(request, "params", parsedRequest.params);
      replaceRequestValue(request, "query", parsedRequest.query);

      next();
    } catch (error) {
      next(error);
    }
  };
}
