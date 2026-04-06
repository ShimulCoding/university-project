import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";

function replaceRecordValues(target: unknown, source: Record<string, unknown>) {
  if (!target || typeof target !== "object") {
    return;
  }

  for (const key of Object.keys(target)) {
    delete (target as Record<string, unknown>)[key];
  }

  Object.assign(target as Record<string, unknown>, source);
}

export function validateRequest(schema: AnyZodObject) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const parsedRequest = schema.parse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    request.body = parsedRequest.body;
    replaceRecordValues(request.params, parsedRequest.params);
    replaceRecordValues(request.query, parsedRequest.query);

    next();
  };
}
