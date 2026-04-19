import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";

export function validateRequest(schema: AnyZodObject) {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      const parsedRequest = schema.parse({
        body: request.body,
        params: request.params,
        query: request.query,
      });

      request.body = parsedRequest.body;
      request.params = parsedRequest.params;
      request.query = parsedRequest.query;

      next();
    } catch (error) {
      next(error);
    }
  };
}
