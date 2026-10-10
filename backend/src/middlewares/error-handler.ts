import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (response.headersSent) { _next(error); return; }
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Validation failed.",
      issues: error.flatten(),
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode = { P2002: 409, P2003: 409, P2025: 404, P2034: 409 }[error.code] ?? 500;

    response.status(statusCode).json({
      message:
        error.code === "P2002"
          ? "A record with this value already exists."
          : statusCode === 404 ? "Record not found." : statusCode === 409 ? "The record changed or is still in use." : "Internal server error.",
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

  if (error instanceof AppError) {
    response.status(error.statusCode).json({ message: error.statusCode < 500 ? error.message : "Internal server error." });
    return;
  }
  const bodyError = error as { type?: string } | null;
  if (bodyError?.type === "entity.parse.failed") {
    response.status(400).json({ message: "Request body contains invalid JSON." });
    return;
  }
  if (bodyError?.type === "entity.too.large") {
    response.status(413).json({ message: "Request body is too large." });
    return;
  }
  console.error("Unhandled API error", error);
  response.status(500).json({ message: "Internal server error." });
}
