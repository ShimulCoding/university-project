import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { generate } from "otplib";
import { RoleCode } from "@prisma/client";
import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/password";
import { createEnrollmentGrant } from "../src/modules/auth/services/mfa.service";
import { checkPageDesign } from "../../frontend/scripts/browser-design-checks";

const run = randomUUID(); const users: string[] = []; let eventId: string | undefined; let step = "setup";
async function main() {
  const browser = await chromium.launch({ channel: process.env.VERIFY_BROWSER_CHANNEL || "msedge", headless: true });
  const context = await browser.newContext(); const page = await context.newPage(); let checks = 0;
  const frontend = process.env.VERIFY_FRONTEND_BASE_URL || "http://localhost:3000";
  const api = process.env.VERIFY_API_BASE_URL || "http://localhost:4000/api";
  if (![frontend, api].every((value) => ["localhost", "127.0.0.1"].includes(new URL(value).hostname))) throw new Error("Local browser targets required.");
  const password = `Mfa-browser-${run}!`;
  try {
    const passwordHash = await hashPassword(password); const sysRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SYSTEM_ADMIN } });
    async function user(label: string, admin = false) {
      const result = await prisma.user.create({ data: { fullName: `MFA browser ${label}`, email: `mfa-browser-${label}-${run}@example.invalid`, passwordHash, ...(admin ? { roles: { create: { roleId: sysRole.id } } } : {}) } }); users.push(result.id); return result;
    }
    const admin = await user("administrator", true), finance = await user("finance");
    const event = await prisma.event.create({ data: { title: "MFA browser fixture", slug: `mfa-browser-${run}`, status: "PUBLISHED" } }); eventId = event.id;
    await prisma.eventTeamMember.create({ data: { eventId, userId: finance.id, roleCode: RoleCode.FINANCIAL_CONTROLLER } });
    for (const [label, roleCode] of [["event-admin", RoleCode.EVENT_ADMIN], ["manager", RoleCode.EVENT_MANAGEMENT_USER], ["approver", RoleCode.ORGANIZATIONAL_APPROVER]] as const) {
      const member = await user(label); await prisma.eventTeamMember.create({ data: { eventId, userId: member.id, roleCode } });
    }
    async function passwordStage(route: string, email: string, button: string) {
      step = "password-only browser sign-in"; await page.goto(`${frontend}${route}`);
      await page.locator('input[type="email"]').fill(email); await page.locator('input[type="password"]').fill(password);
      await page.getByRole("button", { name: button, exact: true }).click();
      await page.getByRole("heading", { name: "Set up your authenticator" }).waitFor(); checks++;
      assert.equal((await context.request.get(`${api}/auth/me`)).status(), 401); checks++;
    }
    async function enroll(code: string, completion: string) {
      step = "browser enrollment"; await page.getByLabel("Enrollment authorization code").fill(code);
      await page.getByRole("button", { name: "Authorize setup", exact: true }).click();
      step = "browser authenticator setup key";
      const secret = await page.getByLabel("Authenticator setup key").inputValue(); assert(secret.length >= 32); checks++;
      await page.getByLabel("Authenticator code", { exact: true }).fill(await generate({ secret }));
      await page.getByRole("button", { name: "Verify sign-in", exact: true }).click();
      step = "browser verification/recovery display";
      await page.getByRole("heading", { name: "Save your recovery codes" }).waitFor();
      const codes = await page.getByRole("list", { name: "One-use recovery codes" }).locator("code").allTextContents(); assert.equal(codes.length, 8); checks++;
      step = "browser recovery accessibility"; checks += await checkPageDesign(page, "mfa-recovery-codes");
      await page.getByLabel("I stored these codes safely.").check();
      await page.getByRole("button", { name: "Continue to workspace", exact: true }).click();
      step = "browser completed workspace";
      await page.getByText(completion, { exact: true }).first().waitFor(); checks++;
      return codes;
    }
    await passwordStage("/dashboard", admin.email, "Sign in as System Admin");
    checks += await checkPageDesign(page, "mfa-enrollment-authorization");
    const grant = await createEnrollmentGrant(admin.id, undefined); await enroll(grant.code, "System administration");
    step = "supervised grant browser authorization";
    await page.goto(`${frontend}/dashboard/users?userId=${finance.id}`);
    await page.getByLabel("Your current administrator password").fill(password);
    await page.getByLabel("I verified this person’s identity.").check();
    await page.getByRole("button", { name: "Issue one-use setup code", exact: true }).click();
    const enrollmentCode = await page.getByLabel("One-use enrollment code").inputValue(); assert(/^[a-f0-9]{64}$/.test(enrollmentCode)); checks++;
    assert.equal((await context.request.post(`${api}/auth/logout`)).status(), 204); checks++;
    await passwordStage(`/dashboard/events/${event.slug}`, finance.email, "Open event workspace");
    const recovery = await enroll(enrollmentCode, "Event Team Active");
    assert.equal((await context.request.post(`${api}/auth/logout`)).status(), 204); checks++;
    step = "browser recovery sign-in";
    await page.goto(`${frontend}/dashboard/events/${event.slug}`); await page.locator('input[type="email"]').fill(finance.email); await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Open event workspace", exact: true }).click();
    await page.getByLabel("Authenticator or recovery code").fill(recovery[0]!); await page.getByRole("button", { name: "Verify sign-in", exact: true }).click();
    await page.getByText("Event Team Active", { exact: true }).first().waitFor(); checks++;
    console.log(`MFA browser enrollment, authorization and recovery: ${checks} interaction/design checks passed.`);
  } finally {
    await browser.close();
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityId: { in: users } }, ...(eventId ? [{ eventId }] : [])] } });
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect();
  }
}
void main().catch(() => { console.error(`MFA browser verification failed at ${step}; private details suppressed.`); process.exitCode = 1; });
