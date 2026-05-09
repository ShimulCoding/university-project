"use client";

import { Download } from "lucide-react";

import type { PublicFinancialSummary, PublicFinancialSummaryBreakdownLine } from "@/types";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Pure-JS PDF generator — no external dependencies                  */
/* ------------------------------------------------------------------ */

const PW = 595.28;
const PH = 841.89;
const M = 48;
const RIGHT = PW - M;
const COL_W = RIGHT - M;
const textEncoder = new TextEncoder();

/* ---- Colours for pie/bar charts ---- */
const PIE_HEX = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#0891b2", "#f97316", "#22c55e", "#ec4899", "#0ea5e9",
  "#84cc16", "#e11d48",
];
const BUDGET_HEX = "#7c8594";
const ACTUAL_HEX = "#2dd4a8";

type PdfPage = { cmds: string[] };

/* ---- Low-level PDF helpers ---- */
function esc(v: string) {
  return v
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function txt(v: string, x: number, y: number, s = 10, f = "F1") {
  return `BT /${f} ${s} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(v)}) Tj ET`;
}

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

function pieSector(cx: number, cy: number, rad: number, startDeg: number, endDeg: number, hex: string) {
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
  const n = Number(v);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `Tk ${formatted}`;
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
function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [
    "",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageIds: number[] = [];

  pages.forEach((page) => {
    const content = page.cmds.join("\n");
    const pid = objects.length + 1;
    const cid = pid + 1;
    pageIds.push(pid);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`,
    );
    objects.push(
      `<< /Length ${textEncoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    );
  });

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(textEncoder.encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xref = textEncoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((o) => {
    pdf += `${o.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

/* ------------------------------------------------------------------ */
/*  Main PDF content builder                                          */
/* ------------------------------------------------------------------ */
type CategoryPair = { category: string; budget: number; actual: number };

function buildCategoryPairs(
  expenseItems: PublicFinancialSummaryBreakdownLine[],
  budgetItems: PublicFinancialSummaryBreakdownLine[],
): CategoryPair[] {
  const categories = new Map<string, CategoryPair>();
  for (const item of expenseItems) {
    const cat = item.segment.trim() || "Uncategorized";
    const existing = categories.get(cat);
    if (existing) existing.actual += Number(item.amount);
    else categories.set(cat, { category: cat, budget: 0, actual: Number(item.amount) });
  }
  for (const item of budgetItems) {
    const cat = item.label.trim() || "Uncategorized";
    const existing = categories.get(cat);
    if (existing) existing.budget += Number(item.amount);
    else categories.set(cat, { category: cat, budget: Number(item.amount), actual: 0 });
  }
  return Array.from(categories.values()).sort(
    (a, b) => Math.max(b.budget, b.actual) - Math.max(a.budget, a.actual),
  );
}

function createSummaryPdf(summary: PublicFinancialSummary) {
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
  kv("Published", summary.publishedAt ? formatDate(summary.publishedAt) : "Not published");
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
      ["Verified registration income", money(summary.payload.breakdown.registrationIncome)],
      ["Manual income records", money(summary.payload.breakdown.manualIncome)],
      ["Settled expense records", money(summary.payload.breakdown.settledExpense)],
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
    let currentAngle = -90; // start from top
    incomeItems.forEach((item, index) => {
      const pct = (Number(item.amount) / numericTotal) * 360;
      const slice = pct < 0.5 ? 0.5 : pct;
      // Convert from "degrees from top" to standard math degrees
      const startDeg = currentAngle;
      const endDeg = currentAngle + slice;
      page.cmds.push(pieSector(cx, cy, radius, startDeg, endDeg, PIE_HEX[index % PIE_HEX.length]!));
      currentAngle = endDeg;
    });

    // Centre hole (donut)
    page.cmds.push(`1 1 1 rg`);
    page.cmds.push(
      `${cx.toFixed(2)} ${(cy + 40).toFixed(2)} m ` +
      `${(cx + 40).toFixed(2)} ${(cy + 40).toFixed(2)} ${(cx + 40).toFixed(2)} ${(cy - 40).toFixed(2)} ${cx.toFixed(2)} ${(cy - 40).toFixed(2)} c ` +
      `${(cx - 40).toFixed(2)} ${(cy - 40).toFixed(2)} ${(cx - 40).toFixed(2)} ${(cy + 40).toFixed(2)} ${cx.toFixed(2)} ${(cy + 40).toFixed(2)} c f`,
    );
    page.cmds.push(`0 0 0 rg`);
    page.cmds.push(txt("Total", cx - 12, cy + 5, 8, "F2"));
    page.cmds.push(txt(money(summary.totals.collected), cx - 22, cy - 8, 7, "F2"));

    // Legend on the right
    let ly = y - 16;
    const lx = M + 195;
    incomeItems.forEach((item, index) => {
      const pct = ((Number(item.amount) / numericTotal) * 100).toFixed(1);
      page.cmds.push(rect(lx, ly - 6, 8, 8, PIE_HEX[index % PIE_HEX.length]!));
      page.cmds.push(txt(item.label, lx + 14, ly, 8));
      page.cmds.push(txt(`${money(item.amount)} (${pct}%)`, lx + 14, ly - 11, 7));
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

    const rawMax = Math.max(...pairs.map((p) => Math.max(p.budget, p.actual)), 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const norm = rawMax / magnitude;
    const yMax = norm <= 1 ? magnitude : norm <= 2 ? 2 * magnitude : norm <= 5 ? 5 * magnitude : 10 * magnitude;

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
        const h = Math.max((pair.budget / yMax) * chartH, 1);
        page.cmds.push(rect(gx, chartBottom, singleW, h, BUDGET_HEX));
      }
      if (pair.actual > 0) {
        const h = Math.max((pair.actual / yMax) * chartH, 1);
        page.cmds.push(rect(gx + singleW, chartBottom, singleW, h, ACTUAL_HEX));
      }

      // Category label
      const label = pair.category.length > 10 ? pair.category.slice(0, 9) + "..." : pair.category;
      page.cmds.push(txt(label, gx + barArea / 2 - label.length * 2.5, chartBottom - 12, 7));
    });

    // Baseline
    page.cmds.push(`0 0 0 RG`);
    page.cmds.push(line(chartLeft, chartBottom, chartRight, chartBottom, 0.5));

    y = chartBottom - 24;

    // Detail table
    ensureSpace(pairs.length * 14 + 20);
    addText("Category Detail:", M, 9, "F2");
    y -= 14;
    pairs.forEach((pair) => {
      ensureSpace(16);
      addText(pair.category, M + 4, 8);
      let detail = "";
      if (pair.budget > 0) detail += `B: ${money(pair.budget)}  `;
      detail += `A: ${money(pair.actual)}`;
      const diff = pair.actual - pair.budget;
      if (pair.budget > 0 && diff !== 0) {
        detail += diff > 0 ? `  (+${money(diff)})` : `  (${money(diff)})`;
      }
      addText(detail, 280, 8);
      y -= 14;
    });

    const totalBudget = pairs.reduce((s, p) => s + p.budget, 0);
    const totalActual = pairs.reduce((s, p) => s + p.actual, 0);
    y -= 4;
    page.cmds.push(line(M, y, RIGHT, y, 0.3));
    y -= 14;
    if (totalBudget > 0) {
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
      const pct = Math.max(0, Math.min(100, (Number(item.amount) / numericTotal) * 100));
      const barMax = COL_W - 160;
      const barW = Math.max((pct / 100) * barMax, 1);

      ensureSpace(36);
      addText(item.label, M, 9, "F2");
      addText(`${money(item.amount)} | ${pct.toFixed(1)}%`, RIGHT - 140, 8);
      y -= 14;
      page.cmds.push(rect(M, y - 2, barW, 8, PIE_HEX[index % PIE_HEX.length]!));
      y -= 14;
      addText(`${item.segment}${item.recordCount > 0 ? ` | ${item.recordCount} record(s)` : ""}`, M, 7);
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
        const pct = Math.max(0, Math.min(100, (Number(item.amount) / expenseTotal) * 100));
        const barMax = COL_W - 160;
        const barW = Math.max((pct / 100) * barMax, 1);

        ensureSpace(36);
        addText(item.label, M, 9, "F2");
        addText(`${money(item.amount)} | ${pct.toFixed(1)}%`, RIGHT - 140, 8);
        y -= 14;
        page.cmds.push(rect(M, y - 2, barW, 8, PIE_HEX[(index + 3) % PIE_HEX.length]!));
        y -= 14;
        addText(`${item.segment}${item.recordCount > 0 ? ` | ${item.recordCount} record(s)` : ""}`, M, 7);
        y -= 14;
      });
    }
  }

  /* ===== Footer on every page ===== */
  pages.forEach((p, i) => {
    p.cmds.push(`0.6 0.6 0.6 rg`);
    p.cmds.push(txt(`Page ${i + 1} of ${pages.length}`, PW / 2 - 25, 28, 7));
    p.cmds.push(txt("MU CSE Financial Transparency Platform - Public Disclosure", M, 28, 7));
    p.cmds.push(`0 0 0 rg`);
  });

  return buildPdf(pages);
}

function buildFileName(summary: PublicFinancialSummary) {
  const slug = summary.event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "event"}-financial-summary.pdf`;
}

export function SummaryPdfDownloadButton({ summary }: { summary: PublicFinancialSummary }) {
  return (
    <Button
      type="button"
      onClick={() => {
        const blob = createSummaryPdf(summary);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = buildFileName(summary);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }}
    >
      <Download size={16} aria-hidden="true" />
      Download PDF
    </Button>
  );
}
