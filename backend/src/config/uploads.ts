import path from "path";

import { env } from "./env";

// src/config and dist/config both resolve to the backend directory.
export const uploadsRoot = path.resolve(__dirname, "../..", env.UPLOADS_ROOT);

export function resolveUploadPath(relativePath: string) {
  const absolutePath = path.resolve(uploadsRoot, relativePath);
  const relative = path.relative(uploadsRoot, absolutePath);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("The stored document path is invalid.");
  }
  return absolutePath;
}

export const documentDirectories = {
  PAYMENT_PROOF: path.join(uploadsRoot, "payment-proofs"),
  SUPPORTING_DOCUMENT: path.join(uploadsRoot, "supporting-documents"),
  COMPLAINT_EVIDENCE: path.join(uploadsRoot, "complaint-evidence"),
} as const;

export const uploadRules = {
  PAYMENT_PROOF: {
    allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeBytes: 5 * 1024 * 1024,
  },
  SUPPORTING_DOCUMENT: {
    allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeBytes: 8 * 1024 * 1024,
  },
  COMPLAINT_EVIDENCE: {
    allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFileSizeBytes: 8 * 1024 * 1024,
  },
} as const;

