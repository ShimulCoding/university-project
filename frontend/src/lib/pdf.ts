export type PdfText = { text: string; x: number; y: number; size: number; bold: boolean };
export type PdfCommand = string | PdfText;

export function pdfText(text: string, x: number, y: number, size = 10, font = "F1"): PdfText {
  return { text, x, y, size, bold: font === "F2" };
}

let fonts: Promise<Uint8Array[]> | undefined;
async function loadFonts() {
  if (!fonts) {
    fonts = Promise.all(["NotoSansBengali-Regular", "NotoSansBengali-Bold", "NotoSans-Regular", "NotoSans-Bold"].map(async (name) => {
      const response = await fetch(`/fonts/${name}.ttf`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("Unable to load the PDF fonts. Please retry.");
      return new Uint8Array(await response.arrayBuffer());
    })).catch((error) => { fonts = undefined; throw error; });
  }
  return fonts;
}

/** Preserve existing vector layouts, with embedded fonts and shaped Unicode text. */
export async function createPdf(pages: PdfCommand[][], width: number, height: number, fontBytes?: Uint8Array[]) {
  const [{ default: PDFDocument }, bytes] = await Promise.all([import("pdfkit"), fontBytes ?? loadFonts()]);
  // PDFKit 0.20 supports disabling the built-in font; its older types omit null.
  // @ts-expect-error The documented browser option avoids loading standard font metrics.
  const doc = new PDFDocument({ autoFirstPage: false, font: null, margin: 0, size: [width, height] });
  doc.registerFont("BengaliRegular", bytes[0]!);
  doc.registerFont("BengaliBold", bytes[1]!);
  doc.registerFont("LatinRegular", bytes[2]!);
  doc.registerFont("LatinBold", bytes[3]!);
  const output = new Promise<Blob>((resolve, reject) => {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(new Uint8Array(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(new Blob(chunks, { type: "application/pdf" })));
  });
  for (const commands of pages) {
    doc.addPage();
    doc.fillColor("black");
    for (const command of commands) {
      if (typeof command !== "string") {
        const runs = (command.text.match(/[\u0980-\u09FF\u200C\u200D]+|[^\u0980-\u09FF\u200C\u200D]+/gu) ?? []).map((text) => ({
          text,
          font: `${/[\u0980-\u09FF]/u.test(text) ? "Bengali" : "Latin"}${command.bold ? "Bold" : "Regular"}`,
        }));
        const measured = runs.reduce((width, run) => width + doc.font(run.font).fontSize(command.size).widthOfString(run.text), 0);
        const available = width - 48 - command.x;
        const size = measured > available ? command.size * available / measured : command.size;
        let x = command.x;
        // Keep logical text available to readers that support ActualText, even
        // when Bengali shaping reorders glyphs for their visual placement.
        doc.markContent("Span", { actual: command.text });
        for (const run of runs) {
          doc.font(run.font).fontSize(size).text(run.text, x, height - command.y, { lineBreak: false, baseline: "alphabetic" });
          x += doc.widthOfString(run.text);
        }
        doc.endMarkedContent();
      } else {
        const color = command.match(/^\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg\s*$/);
        if (color) doc.fillColor([Number(color[1]) * 255, Number(color[2]) * 255, Number(color[3]) * 255]);
        else doc.save().transform(1, 0, 0, -1, 0, height).addContent(command).restore();
      }
    }
  }
  doc.end();
  return output;
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give browsers time to consume the download before releasing its URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
