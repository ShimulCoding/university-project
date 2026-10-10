import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
import { checkPageDesign } from "./browser-design-checks";

const base = process.env.VERIFY_FRONTEND_BASE_URL || "http://localhost:3000";
const api = process.env.VERIFY_API_BASE_URL || "http://localhost:4000/api";
const screenshotDirectory = process.env.VERIFY_DESIGN_SCREENSHOTS
  ? path.resolve(process.env.VERIFY_DESIGN_SCREENSHOTS)
  : undefined;

async function publicData<T>(resource: string): Promise<T> {
  const response = await fetch(api + resource, {
    signal: AbortSignal.timeout(15_000),
  });
  assert(
    response.ok,
    `Public API route failed: ${resource} (${response.status})`,
  );
  return response.json() as Promise<T>;
}

async function main() {
  const [events, summaries] = await Promise.all([
    publicData<{
      events: { slug: string }[];
    }>("/events"),
    publicData<{ summaries: { event: { slug: string } }[] }>(
      "/public/financial-summaries?latestOnly=true",
    ),
  ]);
  const routes = [
    "/",
    "/events",
    "/financial-summaries",
    "/complaints",
    "/complaints/new",
    "/dashboard",
    "/reset-password",
    "/reset-password?token=design-preview-only",
    "/design-verification-missing-page",
  ];
  if (events.events[0])
    routes.push(
      `/events/${events.events[0].slug}`,
      `/events/${events.events[0].slug}/register`,
      `/dashboard/events/${events.events[0].slug}`,
    );
  for (const summary of summaries.summaries)
    routes.push(`/financial-summaries/${summary.event.slug}`);
  const browser = await chromium.launch({
    channel: process.env.VERIFY_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  let checks = 0;
  const errors: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of routes) {
      const response = await page.goto(base + route);
      assert(
        response?.ok() || response?.status() === 404,
        `Route failed: ${route}`,
      );
      await page.waitForLoadState("networkidle");
      await page.locator("main#main-content").waitFor();
      checks += await checkPageDesign(page, route, screenshotDirectory);
      console.log(`Design checked ${route}`);
    }
    await page.goto(base + "/");
    const fallbackFont = await page.evaluate(() => {
      const previous = document.body.className;
      try {
        document.body.className = "";
        return getComputedStyle(document.body).fontFamily;
      } finally {
        document.body.className = previous;
      }
    });
    assert(
      fallbackFont.includes("Segoe UI"),
      "Error/recovery views need a font fallback when layout font variables are absent",
    );
    checks++;
    await page.setViewportSize({ width: 360, height: 800 });
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").innerText(), "Skip to content");
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator(":focus").getAttribute("id"),
      "main-content",
    );
    await page.getByLabel("Open navigation").click();
    assert(
      await page
        .getByRole("navigation", { name: "Mobile navigation", exact: true })
        .getByRole("link", { name: "Public events", exact: true })
        .isVisible(),
    );
    await page
      .getByRole("navigation", { name: "Mobile navigation", exact: true })
      .getByRole("link", { name: "Public events", exact: true })
      .click();
    await page.waitForURL(base + "/events");
    assert(
      !(await page
        .getByRole("navigation", { name: "Mobile navigation", exact: true })
        .isVisible()),
    );
    checks += 4;
    await page.getByLabel("Find an event").fill("design-no-matching-event-xyz");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await page.getByText("No matching events", { exact: true }).waitFor();
    assert(
      new URL(page.url()).searchParams.get("search") ===
        "design-no-matching-event-xyz",
    );
    await page.getByRole("link", { name: "Reset", exact: true }).click();
    await page.waitForURL(base + "/events");
    checks += 2;
    const publicStatuses = await page
      .locator('select[name="status"] option')
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter(Boolean),
      );
    for (const status of publicStatuses) {
      const response = await fetch(
        `${api}/events?status=${encodeURIComponent(status)}`,
      );
      assert(
        response.ok,
        `The event filter offered a non-public status: ${status}`,
      );
      await page
        .getByLabel("Event status", { exact: true })
        .selectOption(status);
      await page
        .getByRole("button", { name: "Apply filters", exact: true })
        .click();
      await page.waitForURL((url) => url.searchParams.get("status") === status);
      await page
        .getByRole("heading", { name: "Matching events", exact: true })
        .waitFor();
      checks++;
    }
    for (const summary of summaries.summaries) {
      await page.goto(`${base}/financial-summaries/${summary.event.slug}`);
      await page.waitForLoadState("networkidle");
      const legend = page.locator("main button[aria-pressed]").first();
      if (await legend.count()) {
        await legend.click();
        assert.equal(await legend.getAttribute("aria-pressed"), "true");
        await legend.click();
        assert.equal(await legend.getAttribute("aria-pressed"), "false");
        checks += 2;
      }
      const downloading = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download PDF", exact: true })
        .click();
      assert.equal(
        await (await downloading).failure(),
        null,
        "Financial PDF download failed",
      );
      checks++;
    }
    await page.goto(base + "/dashboard");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("design-preview-only");
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    assert.equal(await password.getAttribute("type"), "text");
    await page
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    assert.equal(await password.getAttribute("type"), "password");
    assert.deepEqual(errors, [], "Browser JavaScript errors");
    checks += 3;
    console.log(
      `Public design verification passed (${checks} checks at 360, 768, 1440, and 1920px, accessibility, keyboard, navigation, search, password visibility).`,
    );
  } finally {
    await browser.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
