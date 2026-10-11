import type { DocumentCategory } from "@prisma/client";

import { storageProvider } from "../storage";
import { AppError } from "./app-error";
import { uploadScanner } from "./upload-scanner";

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

  if (!Buffer.isBuffer(file.buffer) || file.size !== file.buffer.length || file.size === 0) {
    throw new AppError(400, "Uploaded file is empty or incomplete.");
  }

  const signatures: Record<string, Buffer> = {
    "application/pdf": Buffer.from("%PDF-"),
    "image/png": Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    "image/jpeg": Buffer.from([255, 216, 255]),
  };
  const signature = signatures[file.mimetype];
  if (!signature || !file.buffer.subarray(0, signature.length).equals(signature)) {
    throw new AppError(400, "Uploaded content does not match the declared file type.");
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
  await uploadScanner.scan(file.buffer);

  const storedFile = await storageProvider.saveFile({
    buffer: file.buffer,
    destinationDir: options.destinationDir,
    originalName: `document.${{ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" }[file.mimetype]}`,
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

// Validate the entire batch before saving; clean up prior saves if storage fails.
export async function storeValidatedUploads(
  files: Express.Multer.File[] | undefined,
  options: Parameters<typeof storeValidatedUpload>[1],
) {
  for (const file of files ?? []) assertUploadMatchesRule(file, options.rule, options.documentName);
  const stored: StoredUpload[] = [];
  try {
    for (const file of files ?? []) stored.push(await storeValidatedUpload(file, options));
    return stored;
  } catch (error) {
    await cleanupStoredUploads(stored);
    throw error;
  }
}
