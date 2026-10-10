"use client";

import { useState } from "react";
import {
  createPdf,
  downloadPdf,
  pdfText as unicodeText,
  type PdfCommand,
} from "@/lib/pdf";
import { getApiErrorMessage } from "@/lib/api/shared";

import { Download } from "lucide-react";

import type { PublicFinancialSummary } from "@/types";
import { formatDate, formatMoney, sumExactMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  buildCategoryPairs,
  financialChartPalette,
  pieSlices,
} from "@/lib/charts";

/* ------------------------------------------------------------------ */
/*  Financial tables and vector charts for the shared PDF renderer     */
/* ------------------------------------------------------------------ */

const PW = 595.28;
const PH = 841.89;
const M = 48;
const RIGHT = PW - M;
const COL_W = RIGHT - M;

/* ---- Colours for pie/bar charts ---- */
const PIE_HEX = financialChartPalette.income;
const BUDGET_HEX = financialChartPalette.budget;
const ACTUAL_HEX = financialChartPalette.actual;

type PdfPage = { cmds: PdfCommand[] };

/* ---- Low-level PDF helpers ---- */
const txt = unicodeText;

function line(x1: number, y1: number, x2: number, y2: number, w = 0.6) {
  return `${w} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}

function rect(x: number, y: number, w: number, h: number, hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f 0 0 0 rg`;
}

function setColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function pieSector(
  cx: number,
  cy: number,
  rad: number,
  startDeg: number,
  endDeg: number,
  hex: string,
) {
  const cmds: string[] = [];
  cmds.push(setColor(hex));

  // Move to center
  cmds.push(`${cx.toFixed(2)} ${cy.toFixed(2)} m`);

  // Line to start of arc
  const sRad = (startDeg * Math.PI) / 180;
  const sx = cx + rad * Math.cos(sRad);
  const sy = cy + rad * Math.sin(sRad);
  cmds.push(`${sx.toFixed(2)} ${sy.toFixed(2)} l`);

  // Approximate arc with cubic bezier segments (max 90 deg each)
  let angle = startDeg;
  while (angle < endDeg) {
    const span = Math.min(90, endDeg - angle);
    const a1 = (angle * Math.PI) / 180;
    const a2 = ((angle + span) * Math.PI) / 180;
    const alpha = (4 / 3) * Math.tan((a2 - a1) / 4);
    const p1x = cx + rad * Math.cos(a1);
    const p1y = cy + rad * Math.sin(a1);
    const p4x = cx + rad * Math.cos(a2);
    const p4y = cy + rad * Math.sin(a2);
    const p2x = p1x - alpha * rad * Math.sin(a1);
    const p2y = p1y + alpha * rad * Math.cos(a1);
    const p3x = p4x + alpha * rad * Math.sin(a2);
    const p3y = p4y - alpha * rad * Math.cos(a2);
    cmds.push(
      `${p2x.toFixed(2)} ${p2y.toFixed(2)} ${p3x.toFixed(2)} ${p3y.toFixed(2)} ${p4x.toFixed(2)} ${p4y.toFixed(2)} c`,
    );
    angle += span;
  }

  cmds.push("f"); // fill
  cmds.push("0 0 0 rg"); // reset to black
  return cmds.join("\n");
}

function money(v: string | number) {
  return formatMoney(v).replace("৳", "Tk");
}

function wrapText(value: string, maxWidth: number, fontSize: number) {
  const maxChars = Math.max(12, Math.floor(maxWidth / (fontSize * 0.52)));
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

/* ---- Build the multi-page PDF ---- */

/* ------------------------------------------------------------------ */
/*  Main PDF content builder                                          */
/* ------------------------------------------------------------------ */
export function createSummaryPdf(
  summary: PublicFinancialSummary,
  fontBytes?: Uint8Array[],
) {
  const pages: PdfPage[] = [];
  let page!: PdfPage;
  let y = PH - M;

  const addPage = () => {
    page = { cmds: [] };
    pages.push(page);
    y = PH - M;
  };

  const ensureSpace = (h: number) => {
    if (y - h < M) addPage();
  };

  const addText = (v: string, x: number, s = 10, f = "F1") => {
    page.cmds.push(txt(v, x, y, s, f));
  };

  const addWrapped = (v: string, x: number, mw: number, s = 10, f = "F1") => {
    wrapText(v, mw, s).forEach((l) => {
      page.cmds.push(txt(l, x, y, s, f));
      y -= s + 4;
    });
  };

  const kv = (label: string, value: string) => {
    ensureSpace(20);
    addText(label, M, 9, "F2");
    addWrapped(value, 200, COL_W - 200, 9);
  };

  /* ===== Page 1: Header + Totals + Summary Table ===== */
  addPage();

  addText("Public Financial Summary", M, 20, "F2");
  y -= 26;
  addText("MU CSE Financial Transparency Platform", M, 10);
  y -= 20;
  page.cmds.push(line(M, y, RIGHT, y));
  y -= 24;

  kv("Event", summary.event.title);
  kv("Status", summary.event.status);
  kv(
    "Published",
    summary.publishedAt ? formatDate(summary.publishedAt) : "Not published",
  );
  kv("Reconciliation", summary.reconciliation.status);

  y -= 12;
  ensureSpace(30);
  addText("Financial Totals", M, 14, "F2");
  y -= 22;
  page.cmds.push(line(M, y, RIGHT, y));
  y -= 16;

  /* Totals table */
  const totals: [string, string][] = [
    ["Total Collected", money(summary.totals.collected)],
    ["Total Spent", money(summary.totals.spent)],
    ["Closing Balance", money(summary.totals.closingBalance)],
  ];
  totals.forEach((row) => {
    ensureSpace(18);
    addText(row[0], M, 10, "F2");
    addText(row[1], 400, 10, "F2");
    y -= 16;
  });

  y -= 8;
  page.cmds.push(line(M, y, RIGHT, y));
  y -= 16;

  /* Breakdown table */
  if (summary.payload) {
    ensureSpace(30);
    addText("Summary Breakdown", M, 14, "F2");
    y -= 22;
    page.cmds.push(line(M, y, RIGHT, y));
    y -= 16;

    const rows: [string, string][] = [
      [
        "Verified registration income",
        money(summary.payload.breakdown.registrationIncome),
      ],
      ["Manual income records", money(summary.payload.breakdown.manualIncome)],
      [
        "Settled expense records",
        money(summary.payload.breakdown.settledExpense),
      ],
    ];
    rows.forEach((row) => {
      ensureSpace(18);
      addText(row[0], M, 9);
      addText(row[1], 400, 9, "F2");
      y -= 16;
    });
  }

  /* ===== Income Pie Chart ===== */
  const incomeItems = summary.payload?.incomeBreakdown ?? [];
  const numericTotal = Number(summary.totals.collected);

  if (incomeItems.length > 0 && numericTotal > 0) {
    y -= 16;
    ensureSpace(230);
    addText("Income Source Breakdown (Pie Chart)", M, 14, "F2");
    y -= 22;
    page.cmds.push(line(M, y, RIGHT, y));
    y -= 10;

    const cx = M + 85;
    const cy = y - 85;
    const radius = 75;

    // Draw pie slices
    pieSlices(incomeItems.map((item) => item.amount)).forEach(
      ({ index, startAngle, endAngle }) => {
        page.cmds.push(
          pieSector(
            cx,
            cy,
            radius,
            startAngle - 90,
            endAngle - 90,
            PIE_HEX[index % PIE_HEX.length]!,
          ),
        );
      },
    );

    // Centre hole (donut)
    page.cmds.push(`1 1 1 rg`);
    page.cmds.push(
      `${cx.toFixed(2)} ${(cy + 40).toFixed(2)} m ` +
        `${(cx + 40).toFixed(2)} ${(cy + 40).toFixed(2)} ${(cx + 40).toFixed(2)} ${(cy - 40).toFixed(2)} ${cx.toFixed(2)} ${(cy - 40).toFixed(2)} c ` +
        `${(cx - 40).toFixed(2)} ${(cy - 40).toFixed(2)} ${(cx - 40).toFixed(2)} ${(cy + 40).toFixed(2)} ${cx.toFixed(2)} ${(cy + 40).toFixed(2)} c f`,
    );
    page.cmds.push(`0 0 0 rg`);
    page.cmds.push(txt("Total", cx - 12, cy + 5, 8, "F2"));
    page.cmds.push(
      txt("BDT", cx - 8, cy - 8, 7, "F2"),
    );

    // Legend on the right
    let ly = y - 16;
    const lx = M + 195;
    incomeItems.forEach((item, index) => {
      const pct = ((Number(item.amount) / numericTotal) * 100).toFixed(1);
      page.cmds.push(rect(lx, ly - 6, 8, 8, PIE_HEX[index % PIE_HEX.length]!));
      page.cmds.push(txt(item.label, lx + 14, ly, 8));
      page.cmds.push(
        txt(`${money(item.amount)} (${pct}%)`, lx + 14, ly - 11, 7),
      );
      ly -= 26;
    });

    y = Math.min(cy - radius - 12, ly - 4);
  }

  /* ===== Expense: Budget vs Actual (Bar Chart) ===== */
  const expenseItems = summary.payload?.expenseBreakdown ?? [];
  const budgetItems = summary.payload?.budgetBreakdown ?? [];
  const pairs = buildCategoryPairs(expenseItems, budgetItems);

  if (pairs.length > 0) {
    y -= 16;
    ensureSpace(260);

    if (y - 260 < M) addPage();

    addText("Expense: Budget vs Actual (Bar Chart)", M, 14, "F2");
    y -= 22;
    page.cmds.push(line(M, y, RIGHT, y));
    y -= 10;

    // Legend
    page.cmds.push(rect(M, y - 6, 10, 8, BUDGET_HEX));
    page.cmds.push(txt("Budget", M + 14, y, 8));
    page.cmds.push(rect(M + 80, y - 6, 10, 8, ACTUAL_HEX));
    page.cmds.push(txt("Actual", M + 94, y, 8));
    y -= 20;

    // Chart area
    const chartLeft = M + 50;
    const chartRight = RIGHT - 10;
    const chartW = chartRight - chartLeft;
    const chartTop = y;
    const chartH = 150;
    const chartBottom = chartTop - chartH;

    const rawMax = Math.max(
      ...pairs.map((p) => Math.max(p.budget, p.actual)),
      1,
    );
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const norm = rawMax / magnitude;
    const yMax =
      norm <= 1
        ? magnitude
        : norm <= 2
          ? 2 * magnitude
          : norm <= 5
            ? 5 * magnitude
            : 10 * magnitude;

    // Y-axis ticks
    for (let i = 0; i <= 4; i++) {
      const tickVal = (yMax / 4) * i;
      const tickY = chartBottom + (tickVal / yMax) * chartH;
      page.cmds.push(`0.85 0.85 0.85 RG`);
      page.cmds.push(line(chartLeft, tickY, chartRight, tickY, 0.3));
      page.cmds.push(`0 0 0 RG`);
      const label =
        tickVal >= 1_000_000
          ? `${(tickVal / 1_000_000).toFixed(1)}M`
          : tickVal >= 1_000
            ? `${(tickVal / 1_000).toFixed(tickVal >= 10_000 ? 0 : 1)}K`
            : tickVal.toString();
      page.cmds.push(txt(label, chartLeft - 42, tickY - 3, 7));
    }

    // Bars
    const groupW = chartW / pairs.length;
    const barPad = Math.max(groupW * 0.2, 4);
    const barArea = groupW - barPad;
    const singleW = barArea / 2;

    pairs.forEach((pair, i) => {
      const gx = chartLeft + i * groupW + barPad / 2;

      if (pair.budget > 0) {
        const h = (pair.budget / yMax) * chartH;
        page.cmds.push(rect(gx, chartBottom, singleW, h, BUDGET_HEX));
      }
      if (pair.actual > 0) {
        const h = (pair.actual / yMax) * chartH;
        page.cmds.push(rect(gx + singleW, chartBottom, singleW, h, ACTUAL_HEX));
      }

      // Category label
      const label =
        pair.category.length > 10
          ? pair.category.slice(0, 9) + "..."
          : pair.category;
      page.cmds.push(
        txt(label, gx + barArea / 2 - label.length * 2.5, chartBottom - 12, 7),
      );
    });

    // Baseline
    page.cmds.push(`0 0 0 RG`);
    page.cmds.push(line(chartLeft, chartBottom, chartRight, chartBottom, 0.5));

    y = chartBottom - 24;

    // Detail table
    ensureSpace(36);
    addText("Category Detail:", M, 9, "F2");
    y -= 14;
    pairs.forEach((pair) => {
      const labelLines = wrapText(pair.category, 210, 8);
      const detailLines: string[] = [];
      if (pair.budget > 0)
        detailLines.push(`Budget: ${money(pair.budgetExact)}`);
      detailLines.push(`Actual: ${money(pair.actualExact)}`);
      const diff = Number(pair.difference);
      if (pair.budget > 0 && diff !== 0) {
        detailLines.push(
          `Difference: ${diff > 0 ? "+" : ""}${money(pair.difference)}`,
        );
      }
      const rowHeight =
        Math.max(labelLines.length, detailLines.length) * 12 + 8;
      ensureSpace(rowHeight);
      labelLines.forEach((label, index) =>
        page.cmds.push(txt(label, M + 4, y - index * 12, 8)),
      );
      detailLines.forEach((detail, index) =>
        page.cmds.push(txt(detail, 280, y - index * 12, 8)),
      );
      y -= rowHeight;
    });

    const totalBudget = sumExactMoney(pairs.map((pair) => pair.budgetExact));
    const totalActual = sumExactMoney(pairs.map((pair) => pair.actualExact));
    y -= 4;
    page.cmds.push(line(M, y, RIGHT, y, 0.3));
    y -= 14;
    if (Number(totalBudget) > 0) {
      addText(`Total Budget: ${money(totalBudget)}`, M, 9, "F2");
      y -= 14;
    }
    addText(`Total Actual: ${money(totalActual)}`, M, 9, "F2");
    y -= 14;
  }

  /* ===== Income Source Details (Bar breakdown) ===== */
  if (incomeItems.length > 0 && numericTotal > 0) {
    y -= 16;
    ensureSpace(40);
    addText("Income Source Details", M, 14, "F2");
    y -= 22;
    page.cmds.push(line(M, y, RIGHT, y));
    y -= 14;

    incomeItems.forEach((item, index) => {
      const pct = Math.max(
        0,
        Math.min(100, (Number(item.amount) / numericTotal) * 100),
      );
      const barMax = COL_W - 160;
      const barW = (pct / 100) * barMax;

      ensureSpace(36);
      addText(item.label, M, 9, "F2");
      addText(`${money(item.amount)} | ${pct.toFixed(1)}%`, RIGHT - 140, 8);
      y -= 14;
      page.cmds.push(rect(M, y - 2, barW, 8, PIE_HEX[index % PIE_HEX.length]!));
      y -= 14;
      addText(
        `${item.segment}${item.recordCount > 0 ? ` | ${item.recordCount} record(s)` : ""}`,
        M,
        7,
      );
      y -= 14;
    });
  }

  /* ===== Expense Itemized Breakdown (Bar breakdown) ===== */
  if (expenseItems.length > 0) {
    const expenseTotal = Number(summary.totals.spent);

    if (expenseTotal > 0) {
      y -= 16;
      ensureSpace(40);
      addText("Expense Itemized Breakdown", M, 14, "F2");
      y -= 22;
      page.cmds.push(line(M, y, RIGHT, y));
      y -= 14;

      expenseItems.forEach((item, index) => {
        const pct = Math.max(
          0,
          Math.min(100, (Number(item.amount) / expenseTotal) * 100),
        );
        const barMax = COL_W - 160;
        const barW = (pct / 100) * barMax;

        ensureSpace(36);
        addText(item.label, M, 9, "F2");
        addText(`${money(item.amount)} | ${pct.toFixed(1)}%`, RIGHT - 140, 8);
        y -= 14;
        page.cmds.push(
          rect(M, y - 2, barW, 8, PIE_HEX[(index + 3) % PIE_HEX.length]!),
        );
        y -= 14;
        addText(
          `${item.segment}${item.recordCount > 0 ? ` | ${item.recordCount} record(s)` : ""}`,
          M,
          7,
        );
        y -= 14;
      });
    }
  }

  /* ===== Footer on every page ===== */
  pages.forEach((p, i) => {
    p.cmds.push(`0.6 0.6 0.6 rg`);
    p.cmds.push(txt(`Page ${i + 1} of ${pages.length}`, PW / 2 - 25, 28, 7));
    p.cmds.push(
      txt(
        "MU CSE Financial Transparency Platform - Public Disclosure",
        M,
        28,
        7,
      ),
    );
    p.cmds.push(`0 0 0 rg`);
  });

  return createPdf(
    pages.map((page) => page.cmds),
    PW,
    PH,
    fontBytes,
  );
}

function buildFileName(summary: PublicFinancialSummary) {
  const slug = summary.event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "event"}-financial-summary.pdf`;
}

export function SummaryPdfDownloadButton({
  summary,
}: {
  summary: PublicFinancialSummary;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            downloadPdf(
              await createSummaryPdf(summary),
              buildFileName(summary),
            );
          } catch (error) {
            setError(
              getApiErrorMessage(
                error,
                "Unable to generate the PDF. Please retry.",
              ),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <Download size={16} aria-hidden="true" />
        {pending ? "Preparing PDF..." : "Download PDF"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
