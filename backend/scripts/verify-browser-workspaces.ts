import assert from "node:assert/strict";
import { chromium, type BrowserContext } from "playwright";
import { prisma } from "../src/config/prisma";
import { checkPageDesign } from "../../frontend/scripts/browser-design-checks";
import path from "node:path";

type Fixture = {
  frontend: string;
  eventSlug: string;
  eventId: string;
  financeId: string;
  otherSlug: string;
  financeEmail: string;
  financeRecoveryCode: string;
  studentId: string;
  studentUserId: string;
  password: string;
  adminCookie: string;
  managerCookie: string;
  approverCookie: string;
};

export async function verifyBrowserWorkspaces(fixture: Fixture) {
  const browser = await chromium.launch({
    channel: process.env.VERIFY_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  let checks = 0;
  let designChecks = 0;
  const reviewed = new Set<string>();
  const errors: string[] = [];
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => errors.push(error.message));
  async function setSession(context: BrowserContext, cookie: string) {
    await context.clearCookies();
    await context.addCookies(
      cookie.split("; ").map((item) => {
        const index = item.indexOf("=");
        return {
          name: item.slice(0, index),
          value: item.slice(index + 1),
          url: fixture.frontend,
          httpOnly: true,
          sameSite: "Lax" as const,
        };
      }),
    );
  }
  async function bodyIncludes(text: string) {
    await page
      .getByText(text, { exact: false })
      .filter({ visible: true })
      .first()
      .waitFor({ state: "visible" });
    checks++;
  }
  async function reviewDesign(route: string) {
    if (process.env.VERIFY_DESIGN !== "1" || reviewed.has(route)) return;
    reviewed.add(route);
    // Use rendered content as readiness: Next's background link prefetches can
    // keep the network active after session recovery and responsive resizing.
    await page.waitForFunction(
      () =>
        document.readyState === "complete" &&
        document.title.trim().length > 0 &&
        document.querySelectorAll("main#main-content").length === 1,
    );
    const label = route
      .replaceAll(fixture.eventSlug, "assigned-event")
      .replaceAll(fixture.otherSlug, "other-event");
    designChecks += await checkPageDesign(
      page,
      label,
      process.env.VERIFY_DESIGN_SCREENSHOTS
        ? path.resolve(process.env.VERIFY_DESIGN_SCREENSHOTS)
        : undefined,
    );
    console.log(`Workspace design checked ${label}`);
  }
  async function visit(path: string, text: string) {
    const response = await page.goto(fixture.frontend + path);
    assert(response?.ok(), `Browser route failed: ${path}`);
    try {
      await bodyIncludes(text);
    } catch (error) {
      console.error(
        `Browser route ${path}: ${(await page.locator("body").innerText()).slice(0, 1400)}`,
      );
      throw error;
    }
    assert(
      !/Unable to load|Cannot reach the backend|Application error|Something went wrong|System Sync Error/.test(
        await page.locator("body").innerText(),
      ),
      `Browser route rendered an error: ${path}`,
    );
    await reviewDesign(path);
  }
  try {
    await visit(`/dashboard/events/${fixture.eventSlug}`, "Event Team Sign In");
    await page.locator('input[type="email"]').fill(fixture.financeEmail);
    await page.locator('input[type="password"]').fill(fixture.password);
    await page
      .getByRole("button", { name: "Open event workspace", exact: true })
      .click();
    await bodyIncludes("Verify your sign-in");
    await page.getByLabel("Authenticator or recovery code").fill(fixture.financeRecoveryCode);
    await page.getByRole("button", { name: "Verify sign-in", exact: true }).click();
    await bodyIncludes("Event Team Active");
    await reviewDesign(`/dashboard/events/${fixture.eventSlug}?signed-in`);
    await visit(
      `/dashboard/events/${fixture.otherSlug}/income-records`,
      "Access restricted",
    );
    await visit(
      `/dashboard/events/${fixture.eventSlug}/income-records`,
      "Scope donation",
    );
    const label = `Browser audit ${fixture.eventSlug}`;
    const form = page
      .locator("form")
      .filter({
        has: page.getByRole("button", {
          name: "Create income record",
          exact: true,
        }),
      });
    await form.locator('[name="amount"]').fill("2.00");
    await form.locator('[name="sourceLabel"]').fill(label);
    await form
      .locator('[name="referenceText"]')
      .fill("Isolated browser verification evidence");
    await form
      .getByRole("button", { name: "Create income record", exact: true })
      .click();
    await bodyIncludes(label);
    await prisma.incomeRecord.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        eventId: fixture.eventId,
        recordedById: fixture.financeId,
        amount: "1.00",
        sourceType: "DONATION",
        sourceLabel: `Browser pagination ${index}`,
      })),
    });
    await page.reload();
    await page.getByRole("link", { name: "Next", exact: true }).click();
    await page.waitForURL(/page=2/);
    await bodyIncludes("Scope donation");

    // An expired access cookie must recover from the refresh cookie in the browser.
    const cookies = await context.cookies();
    await context.clearCookies();
    await context.addCookies(
      cookies.filter((cookie) => cookie.name.includes("refresh")),
    );
    await visit(
      `/dashboard/events/${fixture.eventSlug}/income-records?page=2`,
      label,
    );
    await visit(
      `/dashboard/events/${fixture.eventSlug}/payments`,
      "Scope participant",
    );

    await setSession(context, fixture.managerCookie);
    await visit("/dashboard/my-events", "Event Workspaces");
    for (const [path, text] of [
      ["", "Event Team Active"],
      ["/budgets", "Final"],
      ["/budget-requests", "Scope budget"],
      ["/funding-requests", "Event funding"],
      ["/expense-requests", "Scope expense request"],
      ["/expense-records", "Scope expense"],
      ["/reconciliation", "Reconciliation"],
      ["/publications", "Public"],
    ]) {
      await visit(`/dashboard/events/${fixture.eventSlug}${path}`, text!);
    }
    await setSession(context, fixture.approverCookie);
    await visit(
      `/dashboard/events/${fixture.eventSlug}/approvals`,
      "Approval Decisions",
    );
    await visit(
      `/dashboard/events/${fixture.eventSlug}/complaints`,
      "Scope complaint",
    );

    await setSession(context, fixture.adminCookie);
    for (const [path, text] of [
      ["", "System administration"],
      ["/events", "Events"],
      ["/users", "Platform accounts"],
      ["/audit", "Audit"],
      ["/complaints", "Scope platform complaint"],
    ]) {
      await visit(`/dashboard${path}`, text!);
    }
    for (const path of [
      "approvals",
      "budgets",
      "budget-requests",
      "expense-requests",
      "expense-records",
      "income-records",
      "payments",
      "publications",
      "reconciliation",
      "controls",
      "my-events",
    ]) {
      await visit(`/dashboard/${path}`, "System");
    }
    if (process.env.VERIFY_DESIGN === "1") {
      await visit("/dashboard/controls", "Controls & patterns");
      for (const example of ["Data Grids", "System Feedback"]) {
        await page.getByRole("button", { name: new RegExp(example) }).click();
        await reviewDesign(`/dashboard/controls?example=${example}`);
      }
    }
    await visit(
      `/dashboard/users?userId=${fixture.studentUserId}`,
      "Platform accounts",
    );
    const profileForm = page
      .locator("form")
      .filter({
        has: page.getByRole("button", {
          name: "Save account profile",
          exact: true,
        }),
      });
    assert.equal(
      await profileForm.locator('[name="studentId"]').inputValue(),
      fixture.studentId,
    );
    await profileForm
      .locator('[name="fullName"]')
      .fill("Scope browser profile repaired");
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/users/${fixture.studentUserId}/profile`) &&
          response.ok(),
      ),
      profileForm
        .getByRole("button", { name: "Save account profile", exact: true })
        .click(),
    ]);
    await bodyIncludes("Scope browser profile repaired");
    const anotherAccount = page
      .locator('a[href*="userId="]')
      .filter({ hasNotText: "Scope browser profile repaired" })
      .first();
    const otherName = (
      await anotherAccount.locator(".font-semibold").first().innerText()
    ).trim();
    await anotherAccount.click();
    await page.waitForURL(
      (url) => url.searchParams.get("userId") !== fixture.studentUserId,
    );
    await page.waitForFunction(
      (name) =>
        document.querySelector<HTMLInputElement>('input[name="fullName"]')
          ?.value === name,
      otherName,
    );
    assert.equal(
      await profileForm.locator('[name="fullName"]').inputValue(),
      otherName,
      "Selecting another account retained the previous profile fields",
    );
    checks++;
    await context.clearCookies();
    await visit("/", "Financial");
    await visit("/events", "Public events");
    await visit(`/events/${fixture.eventSlug}`, "Scope verification");
    await visit(`/events/${fixture.eventSlug}/register`, "Sign in");
    await visit("/complaints", "Sign in");
    await visit("/complaints/new", "Sign in");
    await visit("/financial-summaries", "Financial summaries");
    const publication = await prisma.publicSummarySnapshot.findFirst({
      where: { status: "PUBLISHED" },
      include: { event: true },
    });
    if (publication) {
      await visit(
        `/financial-summaries/${publication.event.slug}`,
        "Download PDF",
      );
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download PDF", exact: true })
        .click();
      const download = await downloaded;
      assert.equal(
        await download.failure(),
        null,
        "Browser PDF download failed",
      );
      checks++;
    }
    await visit("/reset-password", "Invalid reset link");

    await visit(`/events/${fixture.eventSlug}/register`, "Sign in");
    await page
      .getByRole("button", { name: /^Sign in/ })
      .first()
      .click();
    await page.getByLabel(/Student ID/).fill(fixture.studentId);
    await page.locator('input[type="password"]').fill(fixture.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await bodyIncludes("Create your registration");
    await reviewDesign(
      `/events/${fixture.eventSlug}/register?student-signed-in`,
    );
    assert.equal(
      await page.getByLabel(/Student ID/).inputValue(),
      fixture.studentId,
      "Registration did not use the account's Student ID",
    );
    await page
      .locator("form")
      .getByRole("button", { name: "Register for this event", exact: true })
      .click();
    await page.waitForURL(/\/registrations\/[^/]+$/);
    await page.getByRole("heading", { level: 1, name: / registration$/i }).waitFor({ state: "visible" });
    const registrationUrl = page.url();
    await reviewDesign(new URL(registrationUrl).pathname);
    await visit(
      new URL(registrationUrl).pathname + "/payment-proof",
      "Submit payment proof",
    );
    await page.locator('[name="externalChannel"]').fill("Cash");
    await page.locator('[name="amount"]').fill("2.00");
    await page
      .locator('[name="referenceText"]')
      .fill("Browser owner verification fixture");
    await page
      .locator('[name="proofFile"]')
      .setInputFiles({
        name: "browser-proof.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
      });
    await page
      .getByRole("button", { name: "Submit for verification", exact: true })
      .click();
    await page.waitForURL(registrationUrl);
    await bodyIncludes("browser-proof.pdf");
    await reviewDesign(new URL(registrationUrl).pathname + "?proof-submitted");
    await visit("/complaints/new", "Submit a complaint");
    await reviewDesign("/complaints/new?student-signed-in");
    const complaintSubject = `Browser complaint ${fixture.eventSlug}`;
    await page.locator('[name="eventId"]').selectOption(fixture.eventId);
    await page.locator('[name="subject"]').fill(complaintSubject.slice(0, 140));
    await page
      .locator('textarea[name="description"]')
      .fill(
        "Isolated student complaint submitted during the browser regression audit.",
      );
    await page
      .getByRole("button", { name: "Submit complaint", exact: true })
      .click();
    await bodyIncludes(complaintSubject.slice(0, 140));
    await reviewDesign("/complaints?submitted");
    await page
      .getByRole("button", { name: "Sign out", exact: true })
      .first()
      .click();
    await bodyIncludes("Sign in");
    assert.deepEqual(errors, [], "Browser JavaScript errors were detected");
    console.log(
      `Browser workspace verification passed (${checks} checks, actual UI login, income creation, and session recovery).`,
    );
    if (designChecks)
      console.log(
        `Workspace design verification passed (${designChecks} checks across ${reviewed.size} route states).`,
      );
    return checks + designChecks;
  } finally {
    await browser.close();
  }
}
