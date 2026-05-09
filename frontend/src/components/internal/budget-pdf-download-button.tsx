"use client";

import { Download } from "lucide-react";

import type { BudgetRecord } from "@/types";
import { formatDateTime, formatEnumLabel, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const textEncoder = new TextEncoder();

type PdfPage = {
  commands: string[];
};

function sanitizePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfText(value: string, x: number, y: number, size = 10, font = "F1") {
  return `BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${sanitizePdfText(
    value,
  )}) Tj ET`;
}

function pdfLine(x1: number, y1: number, x2: number, y2: number) {
  return `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}

function wrapText(value: string, maxWidth: number, fontSize: number) {
  const maxChars = Math.max(12, Math.floor(maxWidth / (fontSize * 0.52)));
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;

    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
      return;
    }

    line = candidate;
  });

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

function createPdf(pages: PdfPage[]) {
  const objects: string[] = [
    "",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageObjectIds: number[] = [];

  pages.forEach((page) => {
    const content = page.commands.join("\n");
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;

    pageObjectIds.push(pageObjectId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${textEncoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  });

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(textEncoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = textEncoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function createBudgetPdfBlob(budget: BudgetRecord) {
  const pages: PdfPage[] = [];
  let currentPage!: PdfPage;
  let y = pageHeight - margin;

  const addPage = () => {
    currentPage = { commands: [] };
    pages.push(currentPage);
    y = pageHeight - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin) {
      addPage();
    }
  };

  const addText = (value: string, x: number, size = 10, font = "F1") => {
    currentPage.commands.push(pdfText(value, x, y, size, font));
  };

  const addWrappedText = (value: string, x: number, maxWidth: number, size = 10, font = "F1") => {
    wrapText(value, maxWidth, size).forEach((line) => {
      addText(line, x, size, font);
      y -= size + 4;
    });
  };

  const addKeyValue = (label: string, value: string) => {
    ensureSpace(20);
    addText(label, margin, 9, "F2");
    addWrappedText(value, 180, pageWidth - 228, 9);
  };

  addPage();

  addText("Final Event Budget", margin, 20, "F2");
  y -= 26;
  addText("MU CSE Financial Transparency Platform", margin, 10);
  y -= 20;
  currentPage.commands.push(pdfLine(margin, y, pageWidth - margin, y));
  y -= 24;

  addKeyValue("Event name", budget.event.title);
  addKeyValue("Budget title", budget.title ?? `Version ${budget.version}`);
  addKeyValue("Budget version", `v${budget.version}`);
  addKeyValue("Status", formatEnumLabel(budget.state));
  addKeyValue("Created", formatDateTime(budget.createdAt));
  addKeyValue("Created by", budget.createdBy?.fullName ?? "Not recorded");
  addKeyValue("Approved by", budget.approvedBy?.fullName ?? "Not recorded");
  addKeyValue("Approved at", budget.approvedAt ? formatDateTime(budget.approvedAt) : "Not recorded");
  addKeyValue("Final total", budget.totalAmount ? formatMoney(budget.totalAmount) : "Not recorded");

  y -= 12;
  ensureSpace(40);
  addText("Budget Items", margin, 14, "F2");
  y -= 22;
  currentPage.commands.push(pdfLine(margin, y, pageWidth - margin, y));
  y -= 16;

  addText("Category", margin, 9, "F2");
  addText("Item details", 165, 9, "F2");
  addText("Amount", 482, 9, "F2");
  y -= 12;
  currentPage.commands.push(pdfLine(margin, y, pageWidth - margin, y));
  y -= 12;

  budget.items.forEach((item, index) => {
    const itemLines = [
      ...wrapText(item.label, 270, 9),
      ...(item.notes ? wrapText(`Notes: ${item.notes}`, 270, 8) : []),
    ];
    const categoryLines = wrapText(item.category, 95, 9);
    const rowHeight = Math.max(28, Math.max(itemLines.length, categoryLines.length) * 14 + 12);

    ensureSpace(rowHeight);

    const rowTop = y;
    addText(`${index + 1}.`, margin, 9, "F2");
    categoryLines.forEach((line, lineIndex) => {
      currentPage.commands.push(pdfText(line, 72, rowTop - lineIndex * 14, 9));
    });
    itemLines.forEach((line, lineIndex) => {
      currentPage.commands.push(pdfText(line, 165, rowTop - lineIndex * 14, line.startsWith("Notes:") ? 8 : 9));
    });
    currentPage.commands.push(pdfText(formatMoney(item.amount), 482, rowTop, 9, "F2"));

    y -= rowHeight;
    currentPage.commands.push(pdfLine(margin, y, pageWidth - margin, y));
    y -= 10;
  });

  ensureSpace(32);
  y -= 8;
  currentPage.commands.push(pdfLine(380, y, pageWidth - margin, y));
  y -= 16;
  addText("Final budget total", 380, 10, "F2");
  addText(budget.totalAmount ? formatMoney(budget.totalAmount) : "Not recorded", 482, 10, "F2");

  return createPdf(pages);
}

function buildFileName(budget: BudgetRecord) {
  const title = `${budget.event.title}-budget-v${budget.version}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${title || "event-budget"}.pdf`;
}

export function BudgetPdfDownloadButton({ budget }: { budget: BudgetRecord }) {
  return (
    <Button
      type="button"
      onClick={() => {
        const blob = createBudgetPdfBlob(budget);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = buildFileName(budget);
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
