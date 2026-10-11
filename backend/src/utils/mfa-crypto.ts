import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";

export function encryptMfaSecret(secret: string, userId: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(env.MFA_ENCRYPTION_KEY, "base64"), nonce);
  cipher.setAAD(Buffer.from(`mfa:v1:${userId}`));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptMfaSecret(value: string, userId: string) {
  const [version, nonce, tag, ciphertext, ...extra] = value.split(":");
  if (version !== "v1" || !nonce || !tag || !ciphertext || extra.length) throw new Error("Invalid protected factor.");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(env.MFA_ENCRYPTION_KEY, "base64"), Buffer.from(nonce, "base64"));
  decipher.setAAD(Buffer.from(`mfa:v1:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
