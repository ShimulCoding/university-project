import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Validation failed.",
      issues: error.flatten(),
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode = error.code === "P2002" ? 409 : 400;

    response.status(statusCode).json({
      message:
        error.code === "P2002"
          ? "A record with this value already exists."
          : "Database request failed.",
    });
    return;
  }

  if (error instanceof MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 400 : 422).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Uploaded file exceeds the allowed size."
          : "File upload failed.",
    });
    return;
  }

  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "Internal server error.";

  response.status(statusCode).json({ message });
}
