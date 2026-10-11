import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";

export function encryptMfaSecret(secret: string, userId: string) {
  const nonce = randomBytes(12);
  if (!secret || Buffer.byteLength(secret, "utf8") > 1024) throw new Error("Invalid protected factor.");
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(env.MFA_ENCRYPTION_KEY, "base64"), nonce, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(`mfa:v1:${userId}`));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptMfaSecret(value: string, userId: string) {
  if (value.length > 2048) throw new Error("Invalid protected factor.");
  const [version, nonce, tag, ciphertext, ...extra] = value.split(":");
  if (version !== "v1" || !nonce || !tag || !ciphertext || extra.length) throw new Error("Invalid protected factor.");
  const nonceBytes = Buffer.from(nonce, "base64"), tagBytes = Buffer.from(tag, "base64"), ciphertextBytes = Buffer.from(ciphertext, "base64");
  if (nonceBytes.length !== 12 || tagBytes.length !== 16 || !ciphertextBytes.length || ciphertextBytes.length > 1024 ||
      nonceBytes.toString("base64") !== nonce || tagBytes.toString("base64") !== tag || ciphertextBytes.toString("base64") !== ciphertext) throw new Error("Invalid protected factor.");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(env.MFA_ENCRYPTION_KEY, "base64"), nonceBytes, { authTagLength: 16 });
  decipher.setAAD(Buffer.from(`mfa:v1:${userId}`));
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(ciphertextBytes), decipher.final()]).toString("utf8");
}
