import path from "path";

import { env } from "./env";

export const uploadsRoot = path.resolve(process.cwd(), env.UPLOADS_ROOT);

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

