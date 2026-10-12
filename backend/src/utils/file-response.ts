import type { Response } from "express";
import { basename, dirname, isAbsolute } from "node:path";
import { AppError } from "./app-error";

/** Only call after document authorization, path containment, integrity and audit. */
export function sendAuthorizedLocalFile(response: Response, absolutePath: string) {
  if (!isAbsolute(absolutePath)) throw new AppError(500, "The authorized document path must be absolute.");
  // Express filters dotfiles in the requested path. The configured private root
  // may itself be hidden; scope the request to the already-authorized directory.
  // Default dotfile denial still applies to the filename. Never enable `allow`.
  response.sendFile(basename(absolutePath), { root: dirname(absolutePath) });
}
