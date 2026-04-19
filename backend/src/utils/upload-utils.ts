import type { DocumentCategory } from "@prisma/client";

import { storageProvider } from "../storage";
import { AppError } from "./app-error";

export type StoredUpload = {
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedName: string;
  relativePath: string;
};

type UploadRule = {
  maxFileSizeBytes: number;
  allowedMimeTypes: readonly string[];
};

export async function cleanupStoredUpload(upload: StoredUpload | undefined) {
  if (!upload) {
    return;
  }

  try {
    await storageProvider.removeFile(upload.relativePath);
  } catch {
    // Best effort cleanup only.
  }
}

export async function cleanupStoredUploads(uploads: Array<Pick<StoredUpload, "relativePath">>) {
  await Promise.all(
    uploads.map(async (upload) => {
      try {
        await storageProvider.removeFile(upload.relativePath);
      } catch {
        // Best effort cleanup only.
      }
    }),
  );
}

export function assertUploadMatchesRule(
  file: Express.Multer.File,
  rule: UploadRule,
  documentName = "supporting documents",
) {
  if (!rule.allowedMimeTypes.some((mimeType) => mimeType === file.mimetype)) {
    throw new AppError(400, `Uploaded file type is not allowed for ${documentName}.`);
  }

  if (file.size > rule.maxFileSizeBytes) {
    throw new AppError(400, "Uploaded file exceeds the maximum allowed size.");
  }
}

export async function storeValidatedUpload(
  file: Express.Multer.File,
  options: {
    category: DocumentCategory;
    destinationDir: string;
    rule: UploadRule;
    documentName?: string | undefined;
  },
): Promise<StoredUpload> {
  assertUploadMatchesRule(file, options.rule, options.documentName);

  const storedFile = await storageProvider.saveFile({
    buffer: file.buffer,
    destinationDir: options.destinationDir,
    originalName: file.originalname,
  });

  return {
    category: options.category,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storedName: storedFile.storedName,
    relativePath: storedFile.relativePath,
  };
}
