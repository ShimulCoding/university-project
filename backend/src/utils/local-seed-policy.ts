import { z } from "zod";

export const demoTeam = [
  { fullName: "Finance Controller (Demo)", email: "demo.finance@example.com", roleCode: "FINANCIAL_CONTROLLER" },
  { fullName: "Organizational Approver (Demo)", email: "demo.approver@example.com", roleCode: "ORGANIZATIONAL_APPROVER" },
  { fullName: "Event Manager (Demo)", email: "demo.event.manager@example.com", roleCode: "EVENT_MANAGEMENT_USER" },
  { fullName: "Event Admin (Demo)", email: "demo.event.admin@example.com", roleCode: "EVENT_ADMIN" },
] as const;

export function assertLocalSeedEnvironment(input: NodeJS.ProcessEnv) {
  if (input.NODE_ENV && !["development", "test"].includes(input.NODE_ENV)) throw new Error("Seed requires development/test mode.");
  let database: URL;
  try { database = new URL(input.DATABASE_URL || ""); } catch { throw new Error("Seed requires an explicit local PostgreSQL URL."); }
  if (!["postgresql:", "postgres:"].includes(database.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) {
    throw new Error("Seed only supports a loopback PostgreSQL database.");
  }
}

export function seedPassword(value: string | undefined) {
  // bcrypt has a 72-byte input limit. Templates and historic public demo values
  // must never create privileged accounts, even in an explicitly enabled seed.
  if (!value || value.length < 16 || Buffer.byteLength(value, "utf8") > 72 || /^(demopass123!|change-this-before-seeding)$/i.test(value) || /^(replace[- ]|change[- ]|default[- ])/i.test(value)) {
    throw new Error("Supply a private seed password of at least 16 characters and at most 72 UTF-8 bytes; templates are forbidden.");
  }
  return value;
}

export function localSeedConfig(input: NodeJS.ProcessEnv) {
  assertLocalSeedEnvironment(input);
  const fullName = input.SEED_ADMIN_FULL_NAME?.trim(); const email = input.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = input.SEED_ADMIN_PASSWORD;
  const anyAdminValue = Boolean(fullName || email || password);
  const admin = anyAdminValue ? {
    fullName: z.string().min(2).max(120).parse(fullName),
    email: z.string().email().max(255).parse(email),
    password: seedPassword(password),
  } : undefined;
  if (input.ENABLE_LOCAL_DEMO_SEED && !["true", "false"].includes(input.ENABLE_LOCAL_DEMO_SEED)) throw new Error("Invalid demo seed opt-in.");
  const demo = input.ENABLE_LOCAL_DEMO_SEED === "true";
  return { admin, demoPassword: demo ? seedPassword(input.SEED_DEMO_PASSWORD) : undefined };
}

export function requireDemoSeedPassword(input: NodeJS.ProcessEnv) {
  assertLocalSeedEnvironment(input);
  if (input.ENABLE_LOCAL_DEMO_SEED !== "true") throw new Error("Demo seed requires explicit ENABLE_LOCAL_DEMO_SEED=true.");
  return seedPassword(input.SEED_DEMO_PASSWORD);
}
