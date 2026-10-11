import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { chromium } from "playwright";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/password";
import { createFixtureMfa } from "./helpers/mfa-fixtures";

const run = randomUUID(); let userId: string | undefined; let step = "local targets"; let checks = 0;
const frontend = process.env.VERIFY_FRONTEND_BASE_URL || "http://localhost:3000";
const api = process.env.VERIFY_API_BASE_URL || "http://localhost:4000/api";
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", ...Object.values(networkInterfaces()).flat().filter((entry) => !!entry).map((entry) => entry!.address)]);
function check(condition: unknown, label: string) { step = label; assert(condition, label); checks++; }

async function main() {
  if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.DATABASE_URL).hostname) ||
      ![frontend, api].every((value) => localHosts.has(new URL(value).hostname)) || new URL(frontend).hostname !== new URL(api).hostname) throw new Error("Local database and same-host local app targets required.");
  const browser = await chromium.launch({ channel: process.env.VERIFY_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "SYSTEM_ADMIN" } });
    const password = `Synthetic-network-${run}!`;
    const user = await prisma.user.create({ data: { fullName: "Network sign-in fixture", email: `network-${run}@example.invalid`, passwordHash: await hashPassword(password), roles: { create: { roleId: role.id } } } }); userId = user.id;
    const recovery = await createFixtureMfa(user, run);
    const context = await browser.newContext(); const page = await context.newPage();
    page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    let nativeNavigation = false; const pageErrors: unknown[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    page.on("request", (request) => { if (request.isNavigationRequest() && request.url().endsWith("/dashboard?")) nativeNavigation = true; });
    step = "development/production page hydrates on configured local host";
    await page.goto(`${frontend}/dashboard`);
    await page.getByLabel("Show password").click();
    check(await page.locator('input[autocomplete="current-password"]').getAttribute("type") === "text", "Password-toggle handler hydrates");
    await page.getByLabel("Administrator email", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const passwordResponse = page.waitForResponse((response) => response.url() === `${api}/auth/internal-login` && response.request().method() === "POST");
    await page.getByRole("button", { name: "Sign in as System Admin", exact: true }).click();
    check((await passwordResponse).status() === 200, "Configured-origin password stage succeeds");
    await page.getByRole("heading", { name: "Verify your sign-in", exact: true }).waitFor(); checks++;
    check(!nativeNavigation, "Submitting sign-in does not perform native query navigation");
    check((await context.request.get(`${api}/auth/me`)).status() === 401, "Password alone still cannot access the account");
    const pending = await context.cookies(`${api}/auth/mfa/verify`);
    check(pending.some((cookie) => cookie.name === "mu_mfa_challenge" && cookie.httpOnly && cookie.domain === new URL(frontend).hostname), "Challenge cookie belongs to the browser's actual host");
    step = "actual second factor completes cookie and server-rendered sign-in";
    await page.getByLabel("Authenticator or recovery code").fill(recovery[0]!);
    await page.getByRole("button", { name: "Verify sign-in", exact: true }).click();
    await page.getByText("System administration", { exact: true }).first().waitFor(); checks++;
    check((await context.request.get(`${api}/auth/me`)).status() === 200, "Second factor produces a usable authenticated session");
    await page.reload();
    await page.getByText("System administration", { exact: true }).first().waitFor(); checks++;
    check(!(await page.getByLabel("Administrator email", { exact: true }).count()), "Reload preserves server-rendered dashboard authentication");
    check(pageErrors.length === 0, "No page exception or hydration mismatch occurs");
    check((await prisma.mfaRecoveryCode.count({ where: { userId, usedAt: { not: null } } })) === 1, "Only the isolated fixture's submitted recovery code is consumed");
    check((await context.request.post(`${api}/auth/logout`)).status() === 204, "Configured-origin logout succeeds");
    check((await context.request.get(`${api}/auth/me`)).status() === 401, "Logout revokes the fixture session");
    console.log(`Local network sign-in: ${checks} actual browser/cookie/MFA/server-rendering/negative checks passed.`);
  } finally {
    await browser.close();
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { actorId: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
}
void main().catch(() => { console.error(`Network sign-in verification failed at ${step}; private details suppressed.`); process.exitCode = 1; });
