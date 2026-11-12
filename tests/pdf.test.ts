import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/lib/knowledge/pdf";

/** Assemble a PDF where each object is either text or raw bytes. */
function buildPdf(objects: (string | Uint8Array)[]): Uint8Array {
  const parts: Uint8Array[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  objects.forEach((body, index) => {
    const head = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
    const content =
      typeof body === "string" ? Buffer.from(body, "latin1") : body;
    parts.push(head, content, Buffer.from("\nendobj\n", "latin1"));
  });
  parts.push(Buffer.from("trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}

const catalog = "<< /Type /Catalog /Pages 2 0 R >>";
const pages = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";

function pageWith(contentId: number, fontId = 5) {
  return `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
}
function stream(dict: string, data: string | Uint8Array) {
  const length =
    typeof data === "string" ? Buffer.byteLength(data, "latin1") : data.length;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from(`${dict} /Length ${length} >>\nstream\n`, "latin1"),
      typeof data === "string"
        ? Buffer.from(data, "latin1")
        : Buffer.from(data),
      Buffer.from("\nendstream", "latin1"),
    ]),
  );
}
const helvetica = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

describe("PDF text extraction", () => {
  it("reads a plain content stream line by line", async () => {
    const pdf = buildPdf([
      catalog,
      pages,
      pageWith(4),
      stream(
        "<<",
        "BT /F1 12 Tf 72 720 Td (Photosynthesis) Tj 0 -16 Td (plants convert light) Tj ET",
      ),
      helvetica,
    ]);
    const result = await extractPdfText(pdf);
    expect(result.pages).toBe(1);
    expect(result.text).toBe("Photosynthesis\nplants convert light");
  });

  it("inflates FlateDecode streams", async () => {
    const content = "BT /F1 10 Tf (Compressed text) Tj T* (second line) Tj ET";
    const pdf = buildPdf([
      catalog,
      pages,
      pageWith(4),
      stream("<< /Filter /FlateDecode", new Uint8Array(deflateSync(content))),
      helvetica,
    ]);
    await expect(extractPdfText(pdf)).resolves.toMatchObject({
      text: "Compressed text\nsecond line",
    });
  });

  it("uses a font ToUnicode CMap for non-Latin text", async () => {
    const cmap = [
      "/CIDInit /ProcSet findresource begin",
      "begincmap",
      "1 begincodespacerange <0000> <FFFF> endcodespacerange",
      "1 beginbfchar <0001> <0410> endbfchar",
      "1 beginbfchar <0002> <0411> endbfchar",
      "1 beginbfchar <0003> <0412> endbfchar",
      "endcmap",
    ].join("\n");
    const pdf = buildPdf([
      catalog,
      pages,
      pageWith(4),
      stream("<<", "BT /F1 12 Tf <000100020003> Tj ET"),
      "<< /Type /Font /Subtype /Type0 /BaseFont /Test /ToUnicode 6 0 R >>",
      stream("<<", cmap),
    ]);
    await expect(extractPdfText(pdf)).resolves.toMatchObject({ text: "АБВ" });
  });

  it("treats negative TJ kerns as word gaps and escapes as characters", async () => {
    const pdf = buildPdf([
      catalog,
      pages,
      pageWith(4),
      stream(
        "<<",
        "BT /F1 12 Tf [(Hello) -300 (world)] TJ T* (tab\\there \\(paren\\) \\101) Tj ET",
      ),
      helvetica,
    ]);
    await expect(extractPdfText(pdf)).resolves.toMatchObject({
      text: "Hello world\ntab here (paren) A",
    });
  });

  it("respects the character limit", async () => {
    const pdf = buildPdf([
      catalog,
      pages,
      pageWith(4),
      stream("<<", "BT /F1 12 Tf (abcdefghij) Tj ET"),
      helvetica,
    ]);
    const result = await extractPdfText(pdf, 4);
    expect(result.text).toBe("abcd");
    expect(result.truncated).toBe(true);
  });

  it("explains failures instead of returning noise", async () => {
    await expect(
      extractPdfText(new Uint8Array(Buffer.from("not a pdf"))),
    ).rejects.toThrow(/PDF биш/);
    const pdf = buildPdf([
      catalog,
      pages,
      pageWith(4),
      stream("<<", "BT /F1 12 Tf ET"),
      helvetica,
    ]);
    await expect(extractPdfText(pdf)).rejects.toThrow(/текст олдсонгүй/);
  });
});
