import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { mailer } from "../src/config/mailer";
import { env } from "../src/config/env";
import { authService } from "../src/modules/auth/services/auth.service";
import { hashPassword } from "../src/utils/password";
import { hashValue } from "../src/utils/hash";
import { verifyAccessToken } from "../src/utils/tokens";
import { checkPageDesign } from "../../frontend/scripts/browser-design-checks";

const run = randomUUID(); const users: string[] = [];
let step = "local setup"; let checks = 0;
function check(value: unknown, label: string) { step = label; assert(value, label); checks++; }
async function main() {
  const frontend = process.env.VERIFY_FRONTEND_BASE_URL || "http://localhost:3000";
  const api = process.env.VERIFY_API_BASE_URL || "http://localhost:4000/api";
  if (env.NODE_ENV === "production" || ![frontend, api, env.DATABASE_URL].every((value) => ["localhost", "127.0.0.1"].includes(new URL(value).hostname))) throw new Error("Local nonproduction browser/database targets required.");
  const server = createApp().listen(0, "127.0.0.1");
  const originalMailer = mailer.sendPasswordResetEmail;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let capturedLink = ""; let capturedRecipient = "";
  mailer.sendPasswordResetEmail = async (recipient, link) => { capturedRecipient = recipient; capturedLink = link; };
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const isolatedApi = `http://127.0.0.1:${address.port}/api`;
    const password = `Synthetic-reset-${run}!`;
    const student = await prisma.user.create({ data: { fullName: "Reset transport fixture", email: `reset-${run}@example.invalid`, studentId: `R${run.slice(0, 20)}`, passwordHash: await hashPassword(password) } }); users.push(student.id);
    const session = await authService.login({ studentId: student.studentId!, password }); assert("accessToken" in session);
    const sessionId = verifyAccessToken(session.accessToken).sessionId!;
    step = "actual recovery service issues a fragment link";
    await authService.forgotPassword({ studentId: student.studentId!, email: student.email });
    const link = new URL(capturedLink); const capability = new URLSearchParams(link.hash.slice(1)).get("token")!;
    check(capturedRecipient === student.email, "Only the fixture recipient is selected");
    check(link.pathname === "/reset-password" && !link.search, "New recovery links have no query capability");
    check(/^[a-f0-9]{64}$/.test(capability), "Fragment contains the generated random capability");
    const stored = await prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashValue(capability) } });
    check(stored.userId === student.id && stored.expiresAt > new Date(), "Stored hash and expiry bind the fragment to the fixture");
    check(stored.expiresAt.getTime() <= Date.now() + 60 * 60 * 1000, "Recovery lifetime remains at most one hour");
    browser = await chromium.launch({ channel: process.env.VERIFY_BROWSER_CHANNEL || "msedge", headless: true });
    const context = await browser.newContext(); const page = await context.newPage();
    page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    const pageErrors: unknown[] = []; const consoleErrors: unknown[] = []; const getRequests: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("request", (request) => { if (request.method() === "GET") getRequests.push(request.url()); });
    // The actual built form uses its normal URL. Forward only its reset POST to
    // the isolated source API so these tests never mutate an existing account.
    await page.route(`${api}/auth/reset-password`, async (route) => {
      const response = await route.fetch({ url: `${isolatedApi}/auth/reset-password` });
      await route.fulfill({ response });
    });
    async function submit(nextPassword: string, status: number) {
      await page.getByRole("heading", { name: "Set new password", exact: true }).waitFor();
      await page.getByLabel("New password", { exact: true }).fill(nextPassword);
      const response = page.waitForResponse((value) => value.url() === `${api}/auth/reset-password` && value.request().method() === "POST");
      await page.getByRole("button", { name: "Save new password", exact: true }).click();
      check((await response).status() === status, `Reset POST returns expected ${status}`);
    }
    const nextPassword = `Changed-reset-${run}!`;
    step = "fragment hydration and successful browser reset";
    await page.goto(`${frontend}/reset-password${link.hash}`);
    await page.getByRole("heading", { name: "Set new password", exact: true }).waitFor();
    check(!(await page.getByRole("heading", { name: "Invalid reset link" }).count()), "Hydration resolves the fragment without an invalid-link state");
    checks += await checkPageDesign(page, "fragment-reset-form");
    await submit(nextPassword, 200);
    await page.getByRole("heading", { name: "Password reset successfully", exact: true }).waitFor(); checks++;
    checks += await checkPageDesign(page, "fragment-reset-success");
    check(getRequests.every((url) => !url.includes(capability)), "No new reset capability reaches a browser GET URL");
    check(!!(await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: stored.id } })).usedAt, "Successful reset consumes the capability");
    check((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).sessionVersion === student.sessionVersion + 1, "Password reset advances session version");
    check(!!(await prisma.refreshToken.findUniqueOrThrow({ where: { id: sessionId } })).revokedAt, "Password reset revokes the prior session");
    step = "old session cannot access the account";
    const oldSession = await fetch(`${isolatedApi}/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    check(oldSession.status === 401, "Revoked access session is rejected");
    const fresh = await authService.login({ studentId: student.studentId!, password: nextPassword });
    check("accessToken" in fresh, "New password signs in through the actual service");
    step = "used fragment is rejected";
    await page.goto(`${frontend}/reset-password${link.hash}`); await page.reload(); await submit(`Unused-${run}!`, 400);
    await page.getByRole("alert").filter({ hasText: "already been used" }).waitFor(); checks++;
    check((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).sessionVersion === student.sessionVersion + 1, "Used capability cannot change credentials again");
    step = "expired fragment is rejected";
    const expired = randomBytes(32).toString("hex");
    const expiredRecord = await prisma.passwordResetToken.create({ data: { userId: student.id, tokenHash: hashValue(expired), expiresAt: new Date(Date.now() - 60000) } });
    await page.goto(`${frontend}/reset-password#token=${expired}`);
    await page.getByRole("heading", { name: "Set new password", exact: true }).waitFor();
    check(await page.getByLabel("New password", { exact: true }).inputValue() === "", "Changing capability clears prior form state");
    await submit(`Unused-${run}!`, 400);
    await page.getByRole("alert").filter({ hasText: "expired" }).waitFor(); checks++;
    check(!(await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: expiredRecord.id } })).usedAt, "Expired capability causes no reset write");
    step = "missing and ambiguous fragments fail locally";
    await page.goto(`${frontend}/reset-password`); await page.getByRole("heading", { name: "Invalid reset link", exact: true }).waitFor(); checks++;
    checks += await checkPageDesign(page, "missing-reset-capability");
    await page.goto(`${frontend}/reset-password#token=one&token=two`); await page.getByRole("heading", { name: "Invalid reset link", exact: true }).waitFor(); checks++;
    step = "fragment subscription updates without reload";
    await page.evaluate(() => { window.location.hash = "token=synthetic-unknown-capability"; });
    await page.getByRole("heading", { name: "Set new password", exact: true }).waitFor(); checks++;
    await submit(`Unused-${run}!`, 400);
    check((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).sessionVersion === student.sessionVersion + 1, "Unknown capability cannot change the fixture");
    step = "valid legacy query link remains usable";
    const legacy = randomBytes(32).toString("hex");
    const legacyRecord = await prisma.passwordResetToken.create({ data: { userId: student.id, tokenHash: hashValue(legacy), expiresAt: new Date(Date.now() + 60000) } });
    await page.goto(`${frontend}/reset-password?token=${legacy}`); await submit(`Legacy-reset-${run}!`, 200);
    await page.getByRole("heading", { name: "Password reset successfully", exact: true }).waitFor(); checks++;
    check(!!(await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: legacyRecord.id } })).usedAt, "Legacy query token retains single-use semantics");
    check(pageErrors.length === 0, "No browser exception or hydration error occurs");
    check(!consoleErrors.some((value) => /hydration|did not match|server rendered/i.test(String(value))), "No hydration mismatch is reported");
    console.log(`Reset-link transport: ${checks} isolated service/API/browser/design checks passed; no real mail sent.`);
  } finally {
    mailer.sendPasswordResetEmail = originalMailer;
    await browser?.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
}
void main().catch(() => { console.error(`Reset-link verification failed at ${step}; private details suppressed.`); process.exitCode = 1; });
