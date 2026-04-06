import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { uploadsRoot } from "../../config/uploads";
import type {
  StorageProvider,
  StoredFileInput,
  StoredFileResult,
} from "../types/storage-provider";

export class LocalStorageAdapter implements StorageProvider {
  async saveFile(input: StoredFileInput): Promise<StoredFileResult> {
    await fs.mkdir(input.destinationDir, { recursive: true });

    const extension = path.extname(input.originalName);
    const storedName = `${randomUUID()}${extension}`;
    const absolutePath = path.join(input.destinationDir, storedName);

    await fs.writeFile(absolutePath, input.buffer);

    return {
      storedName,
      absolutePath,
      relativePath: path.relative(uploadsRoot, absolutePath).replaceAll("\\", "/"),
    };
  }

  async removeFile(relativePath: string): Promise<void> {
    const absolutePath = path.join(uploadsRoot, relativePath);

    await fs.rm(absolutePath, { force: true });
  }
}

