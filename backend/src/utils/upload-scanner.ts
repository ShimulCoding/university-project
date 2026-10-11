import { env } from "../config/env";
import { AppError } from "./app-error";
import { scanClamdBuffer } from "./clamd-stream";

export function scannerRequired(config: { NODE_ENV: string; UPLOAD_SCAN_REQUIRED: string }) {
  return config.NODE_ENV === "production" || config.UPLOAD_SCAN_REQUIRED === "true";
}

export const uploadScanner = {
  async scan(buffer: Buffer) {
    if (!scannerRequired(env)) return; // Explicit development-only compatibility.
    if (!env.CLAMD_HOST) throw new AppError(503, "File scanning is unavailable. Please try again later.");
    await scanClamdBuffer(buffer, { host: env.CLAMD_HOST, port: env.CLAMD_PORT, timeoutMs: env.CLAMD_TIMEOUT_MS });
  },
};
