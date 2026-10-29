import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const navy = rgb(11 / 255, 46 / 255, 111 / 255);
const gold = rgb(245 / 255, 183 / 255, 0);
const ink = rgb(15 / 255, 27 / 255, 45 / 255);
const muted = rgb(75 / 255, 91 / 255, 112 / 255);
const line = rgb(214 / 255, 222 / 255, 232 / 255);
const zebra = rgb(244 / 255, 246 / 255, 249 / 255);

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 48;

// Standard PDF fonts only cover WinAnsi; swap common symbols and drop anything else.
function sanitize(font: PDFFont, text: string): string {
  const swapped = text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/\t/g, "  ");
  let result = "";
  for (const char of swapped) {
    try {
      font.encodeText(char);
      result += char;
    } catch {
      result += "?";
    }
  }
  return result;
}

export class PdfWriter {
  private constructor(private doc: PDFDocument, private regular: PDFFont, private bold: PDFFont, private mono: PDFFont, private title: string) {}
  private page!: PDFPage;
  private y = 0;
  private pageNumber = 0;

  static async create(title: string, subtitle: string) {
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    doc.setProducer("OJT Monitor");
    doc.setCreator("OJT Monitor");
    const writer = new PdfWriter(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold), await doc.embedFont(StandardFonts.Courier), title);
    writer.addPage();
    writer.page.drawRectangle({ x: 0, y: PAGE.height - 96, width: PAGE.width, height: 96, color: navy });
    writer.page.drawRectangle({ x: 0, y: PAGE.height - 100, width: PAGE.width, height: 4, color: gold });
    writer.page.drawText("OJT MONITOR", { x: MARGIN, y: PAGE.height - 38, size: 10, font: writer.bold, color: gold });
    writer.page.drawText(sanitize(writer.bold, title), { x: MARGIN, y: PAGE.height - 62, size: 20, font: writer.bold, color: rgb(1, 1, 1) });
    writer.page.drawText(sanitize(writer.regular, subtitle), { x: MARGIN, y: PAGE.height - 82, size: 10, font: writer.regular, color: rgb(0.79, 0.84, 0.93) });
    writer.y = PAGE.height - 128;
    return writer;
  }

  private addPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pageNumber += 1;
    this.y = PAGE.height - MARGIN;
    this.page.drawText(sanitize(this.regular, `${this.title}  ·  Page ${this.pageNumber}`), { x: MARGIN, y: 24, size: 8, font: this.regular, color: muted });
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.addPage();
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const paragraph of sanitize(font, text).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
        else {
          if (current) lines.push(current);
          // Break single words longer than the line (for example digests).
          let rest = word;
          while (font.widthOfTextAtSize(rest, size) > width) {
            let cut = rest.length;
            while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
            lines.push(rest.slice(0, cut));
            rest = rest.slice(cut);
          }
          current = rest;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  heading(text: string) {
    this.ensure(32);
    this.y -= 8;
    this.page.drawText(sanitize(this.bold, text), { x: MARGIN, y: this.y - 14, size: 13, font: this.bold, color: navy });
    this.y -= 22;
    this.page.drawRectangle({ x: MARGIN, y: this.y, width: 32, height: 2, color: gold });
    this.y -= 12;
  }

  paragraph(text: string, options: { mono?: boolean; size?: number; color?: "ink" | "muted" } = {}) {
    const font = options.mono ? this.mono : this.regular;
    const size = options.size ?? 10.5;
    for (const row of this.wrap(text || "—", font, size, PAGE.width - MARGIN * 2)) {
      this.ensure(size + 5);
      this.page.drawText(row, { x: MARGIN, y: this.y - size, size, font, color: options.color === "muted" ? muted : ink });
      this.y -= size + 4.5;
    }
    this.y -= 6;
  }

  fields(items: [string, string][]) {
    const columnWidth = (PAGE.width - MARGIN * 2 - 16) / 2;
    for (let index = 0; index < items.length; index += 2) {
      const pair = items.slice(index, index + 2);
      const heights = pair.map(([, value]) => this.wrap(value, this.bold, 10.5, columnWidth).length);
      const rowHeight = 14 + Math.max(...heights) * 14 + 6;
      this.ensure(rowHeight);
      pair.forEach(([label, value], column) => {
        const x = MARGIN + column * (columnWidth + 16);
        this.page.drawText(sanitize(this.regular, label.toUpperCase()), { x, y: this.y - 9, size: 7.5, font: this.regular, color: muted });
        this.wrap(value, this.bold, 10.5, columnWidth).forEach((row, rowIndex) => this.page.drawText(row, { x, y: this.y - 24 - rowIndex * 14, size: 10.5, font: this.bold, color: ink }));
      });
      this.y -= rowHeight;
    }
  }

  table(headers: string[], rows: string[][], widths: number[]) {
    const total = PAGE.width - MARGIN * 2;
    const columns = widths.map((width) => width * total);
    const drawHeader = () => {
      this.page.drawRectangle({ x: MARGIN, y: this.y - 20, width: total, height: 20, color: navy });
      let x = MARGIN + 6;
      headers.forEach((header, index) => { this.page.drawText(sanitize(this.bold, header), { x, y: this.y - 14, size: 8.5, font: this.bold, color: rgb(1, 1, 1) }); x += columns[index]; });
      this.y -= 20;
    };
    this.ensure(44);
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const wrapped = row.map((cell, index) => this.wrap(cell, this.regular, 9, columns[index] - 10));
      const height = Math.max(...wrapped.map((cell) => cell.length)) * 11 + 9;
      if (this.y - height < MARGIN) { this.addPage(); drawHeader(); }
      if (rowIndex % 2 === 1) this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: total, height, color: zebra });
      let x = MARGIN + 6;
      wrapped.forEach((cell, index) => {
        cell.forEach((text, lineIndex) => this.page.drawText(text, { x, y: this.y - 13 - lineIndex * 11, size: 9, font: this.regular, color: ink }));
        x += columns[index];
      });
      this.y -= height;
      this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + total, y: this.y }, thickness: 0.5, color: line });
    });
    this.y -= 12;
  }

  spacer(height = 8) {
    this.y -= height;
  }

  async bytes() {
    return this.doc.save();
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`, "Cache-Control": "private, no-store" } });
}

export function csvResponse(text: string, filename: string) {
  return new Response(text, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`, "Cache-Control": "private, no-store" } });
}
