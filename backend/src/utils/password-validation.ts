import { z } from "zod";

// bcrypt limits bytes, rather than JavaScript characters. Reject silent truncation.
export const passwordField = z.string().min(8).max(72).refine(
  (password) => Buffer.byteLength(password, "utf8") <= 72,
  "Password must use at most 72 UTF-8 bytes. Use fewer characters for non-English passwords.",
);
