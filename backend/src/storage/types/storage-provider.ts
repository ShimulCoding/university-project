export type StoredFileInput = {
  buffer: Buffer;
  destinationDir: string;
  originalName: string;
};

export type StoredFileResult = {
  storedName: string;
  absolutePath: string;
  relativePath: string;
};

export interface StorageProvider {
  saveFile(input: StoredFileInput): Promise<StoredFileResult>;
  removeFile(relativePath: string): Promise<void>;
}

