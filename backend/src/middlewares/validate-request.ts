import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";

export function validateRequest(schema: AnyZodObject) {
  return (request: Request, _response: Response, next: NextFunction) => {
    schema.parse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    next();
  };
}

