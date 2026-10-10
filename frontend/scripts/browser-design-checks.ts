import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "playwright";

/** Read-only layout and accessibility checks, shared by public and isolated workspace fixtures. */
export async function checkPageDesign(
  page: Page,
  label: string,
  screenshotDirectory?: string,
) {
  let checks = 0;
  await page.evaluate(() => document.fonts.ready);
  const original = page.viewportSize() ?? { width: 1440, height: 1000 };
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.scrollTo(0, 0));
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      main: document.querySelectorAll("main#main-content").length,
      headings: document.querySelectorAll("h1").length,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    }));
    if (layout.scroll > layout.width + 1) {
      console.error(
        label,
        width,
        await page.evaluate(() =>
          Array.from(document.querySelectorAll("main *"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.width > 0 &&
                (rect.right > innerWidth + 1 || rect.left < -1)
              );
            })
            .slice(0, 10)
            .map((element) => ({
              tag: element.tagName,
              class: element.className,
              text: element.textContent?.slice(0, 70),
            })),
        ),
      );
    }
    assert(
      layout.scroll <= layout.width + 1,
      `${label}: horizontal page overflow at ${width}px (${layout.scroll})`,
    );
    assert.equal(
      layout.main,
      1,
      `${label}: exactly one main content landmark is required`,
    );
    assert(layout.headings <= 1, `${label}: duplicate page headings`);
    assert.equal(
      layout.scrollBehavior,
      "auto",
      `${label}: reduced motion should disable smooth scrolling`,
    );
    checks += 4;
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      accessibility.violations.map((issue) => ({
        id: issue.id,
        impact: issue.impact,
        nodes: issue.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      [],
      `${label}: accessibility violations at ${width}px`,
    );
    checks++;
    if (screenshotDirectory && (width === 360 || width === 1440)) {
      await mkdir(screenshotDirectory, { recursive: true });
      const filename = `${label
        .replace(/[^a-z0-9-]/gi, "-")
        .replace(/-+/g, "-")
        .slice(0, 160)}-${width}.png`;
      await page.screenshot({
        path: path.join(screenshotDirectory, filename),
        fullPage: true,
        caret: "initial",
      });
    }
  }
  await page.setViewportSize(original);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return checks;
}
