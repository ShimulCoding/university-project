import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { createEnrollmentGrant } from "../src/modules/auth/services/mfa.service";

async function main() {
  const args = process.argv.slice(2);
  const userId = args[args.indexOf("--user-id") + 1];
  const destination = args[args.indexOf("--output") + 1];
  if (!args.includes("--user-id") || !args.includes("--output") || !userId || !destination || !args.includes("--confirm-supervised-identity")) throw new Error("Required: --user-id, --output and --confirm-supervised-identity.");
  const database = new URL(env.DATABASE_URL);
  if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) throw new Error("This operator utility is restricted to a local nonproduction database.");
  const root = path.resolve(__dirname, "../.."); const privateRoot = path.join(root, ".cache");
  const output = path.resolve(root, destination); const relative = path.relative(privateRoot, output);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new Error("Choose a new private file inside the ignored .cache directory.");
  // Reserve a new file first. Never overwrite an existing file or display a code.
  await fs.mkdir(path.dirname(output), { recursive: true });
  const file = await fs.open(output, "wx", 0o600);
  try {
    const grant = await createEnrollmentGrant(userId, undefined);
    await file.writeFile(`One-use MFA enrollment authorization\nUser ID: ${userId}\nExpires: ${grant.expiresAt.toISOString()}\nCode: ${grant.code}\n`);
  } finally { await file.close(); }
  console.log("Enrollment authorization written to the chosen ignored file; code suppressed. Restrict its Windows ACL before sharing it privately.");
}
void main().catch(() => { console.error("Enrollment authorization failed; private details suppressed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
