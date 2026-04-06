import { createHash } from "crypto";

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

