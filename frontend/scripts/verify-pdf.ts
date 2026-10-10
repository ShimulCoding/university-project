import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createBudgetPdfBlob } from "../src/components/internal/budget-pdf-download-button";
import { createSummaryPdf } from "../src/components/public/summary-pdf-download-button";
import type { BudgetRecord, PublicFinancialSummary } from "../src/types";

async function main() {
  const fonts = await Promise.all(["NotoSansBengali-Regular", "NotoSansBengali-Bold", "NotoSans-Regular", "NotoSans-Bold"].map(async (name) =>
    new Uint8Array(await readFile(`public/fonts/${name}.ttf`)),
  ));
  const event = { id: "fixture", title: "বিশ্ববিদ্যালয় উৎসব", slug: "unicode-fixture", status: "COMPLETED" as const };
  const budget: BudgetRecord = {
    id: "budget", version: 1, title: "Approved budget", state: "APPROVED", totalAmount: "100.00", isActive: true,
    createdAt: "2026-10-10T00:00:00Z", updatedAt: "2026-10-10T00:00:00Z", event, createdBy: null, approvedBy: null, approvedAt: null,
    items: Array.from({ length: 45 }, (_, index) => ({ id: String(index), category: "আয়োজন", label: `উপকরণ ${index + 1}`, amount: "1.00", notes: null })),
  };
  const summary: PublicFinancialSummary = {
    id: "summary", status: "PUBLISHED", publishedAt: "2026-10-10T00:00:00Z", event,
    totals: { collected: "9999999999999999.99", spent: "0.00", closingBalance: "9999999999999999.99" },
    reconciliation: { reportId: "report", status: "FINALIZED", finalizedAt: "2026-10-10T00:00:00Z" }, payload: null,
  };
  for (const [kind, blob] of [["budget", await createBudgetPdfBlob(budget, fonts)], ["summary", await createSummaryPdf(summary, fonts)]] as const) {
    assert.equal(blob.type, "application/pdf");
    const loading = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    const pdf = await loading.promise;
    const texts: string[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      for (const item of content.items) {
        if ("str" in item) {
          texts.push(item.str);
          assert(item.transform[4] + item.width < 595.5, `${kind}: text overflowed the page`);
          assert(item.transform[5] >= 0, `${kind}: text fell below the page`);
        }
      }
    }
    const text = texts.join(" ").replace(/\s+/g, " ");
    assert(text.includes("উৎসব"), `${kind}: Bengali event title was lost`);
    assert(!text.includes("\u0000"), `${kind}: an unsupported glyph was silently emitted`);
    const raw = Buffer.from(await blob.arrayBuffer()).toString("latin1");
    let content = raw;
    for (const stream of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try { content += inflateSync(Buffer.from(stream[1]!, "latin1")).toString("latin1"); } catch { /* Uncompressed streams. */ }
    }
    assert(content.includes("/ActualText"), `${kind}: logical text metadata was omitted`);
    const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", "(": "(", ")": ")" };
    const decoded = content.replace(/\\([nrtbf\\()])/g, (_match, char: string) => escapes[char]!);
    const logicalTitle = Buffer.from(event.title, "utf16le").swap16().toString("latin1");
    assert(decoded.includes(logicalTitle), `${kind}: the logical Bengali title was omitted`);
    if (kind === "budget") {
      assert(pdf.numPages > 1, "Large budgets did not create multiple pages");
      assert(text.includes("উপকরণ 45"), "The final budget item was lost");
    } else assert(text.includes("9,999,999,999,999,999.99"), "Large financial totals were rounded");
    await loading.destroy();
  }
  console.log("PDF verification passed: Bengali text, multiple pages, final items, exact totals, and page bounds.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
