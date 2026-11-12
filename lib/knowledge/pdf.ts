/**
 * Dependency-free PDF text extraction for study material.
 *
 * Handles the common case of text-based PDFs: FlateDecode/uncompressed content
 * streams, `Tj`/`TJ`/`'`/`"` text operators, escaped literal and hex strings,
 * and fonts that ship a `ToUnicode` CMap (needed for Cyrillic and other
 * non-Latin text). Scanned PDFs, object streams and LZW/ASCII85 streams are out
 * of scope: the UI tells the user to paste the text or use the AI image path.
 */

export interface PdfText {
  text: string;
  pages: number;
  truncated: boolean;
}

interface PdfObject {
  id: number;
  dict: string;
  data?: Uint8Array;
}

const decoder = new TextDecoder("latin1");

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const attempts = ["deflate", "deflate-raw"] as const;
  for (const format of attempts)
    try {
      const stream = new Blob([bytes as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream(format));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      // Try the next framing; a raw stream rejects the zlib wrapper and vice versa.
    }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, ""),
    out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1)
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Split an object's `/dict` portion into the object(s) it references. */
function refs(value: string): number[] {
  return [...value.matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));
}

function readObjects(raw: Uint8Array, latin: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const pattern = /(\d+)\s+\d+\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(latin))) {
    const id = Number(match[1]),
      start = match.index + match[0].length,
      end = latin.indexOf("endobj", start);
    if (end < 0) continue;
    const body = latin.slice(start, end),
      streamAt = body.indexOf("stream");
    const dict = streamAt < 0 ? body : body.slice(0, streamAt);
    let data: Uint8Array | undefined;
    if (streamAt >= 0) {
      let from = start + streamAt + "stream".length;
      if (latin[from] === "\r") from += 1;
      if (latin[from] === "\n") from += 1;
      const to = latin.indexOf("endstream", from);
      if (to > from) data = raw.subarray(from, to);
    }
    objects.set(id, { id, dict, data });
    pattern.lastIndex = end;
  }
  return objects;
}

function streamBytes(object: PdfObject): Uint8Array {
  const data = object.data!;
  // `/Length` excludes the EOL that precedes `endstream`; a stray newline is
  // enough to make an otherwise valid zlib stream fail to inflate.
  const declared = object.dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
  if (declared) {
    const length = Number(declared[1]);
    if (length >= 0 && length <= data.length) return data.subarray(0, length);
  }
  let end = data.length;
  while (end > 0 && (data[end - 1] === 10 || data[end - 1] === 13)) end -= 1;
  return data.subarray(0, end);
}

async function objectText(
  object: PdfObject | undefined,
): Promise<string | null> {
  if (!object?.data) return null;
  const data = streamBytes(object);
  if (!/FlateDecode/i.test(object.dict)) return decoder.decode(data);
  const inflated = await inflate(data);
  return inflated ? decoder.decode(inflated) : null;
}

interface CMap {
  map: Map<number, string>;
  bytes: 1 | 2;
}

function parseToUnicode(source: string): CMap {
  const map = new Map<number, string>();
  let bytes: 1 | 2 = 1;
  const utf16 = (hex: string) => {
    const value = hexToBytes(hex);
    if (value.length === 2)
      return String.fromCharCode((value[0] << 8) | value[1]);
    if (value.length === 1) return String.fromCharCode(value[0]);
    let out = "";
    for (let i = 0; i + 1 < value.length; i += 2)
      out += String.fromCharCode((value[i] << 8) | value[i + 1]);
    return out || String.fromCharCode(...value);
  };
  for (const block of source.matchAll(
    /begincodespacerange([\s\S]*?)endcodespacerange/g,
  ))
    if (/<[0-9a-fA-F]{4}>/.test(block[1])) bytes = 2;
  for (const block of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const pair of block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g,
    )) {
      if (pair[1].length >= 4) bytes = 2;
      map.set(parseInt(pair[1], 16), utf16(pair[2]));
    }
  for (const block of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for (const range of block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]*)>|\[([\s\S]*?)\])/g,
    )) {
      const low = parseInt(range[1], 16),
        high = parseInt(range[2], 16);
      if (range[1].length >= 4) bytes = 2;
      if (high - low > 65535) continue;
      if (range[4] !== undefined) {
        const base = hexToBytes(range[4]),
          asText = range[4].length > 2;
        for (let code = low; code <= high; code += 1) {
          if (asText) {
            const next = [...base];
            let carry = code - low,
              i = next.length - 1;
            while (i >= 0 && carry > 0) {
              const sum = next[i] + carry;
              next[i] = sum & 0xff;
              carry = sum >> 8;
              i -= 1;
            }
            map.set(
              code,
              utf16(
                [...next].map((b) => b.toString(16).padStart(2, "0")).join(""),
              ),
            );
          } else map.set(code, String.fromCharCode(base[0] + (code - low)));
        }
      } else {
        const values = [...(range[5] ?? "").matchAll(/<([0-9a-fA-F]*)>/g)];
        values.forEach((value, index) => {
          if (low + index <= high) map.set(low + index, utf16(value[1]));
        });
      }
    }
  return { map, bytes };
}

function mapBytes(value: string, cmap: CMap | null): string {
  const bytes = [...value].map((ch) => ch.charCodeAt(0) & 0xff);
  if (!cmap) {
    // A bare UTF-16BE string (not uncommon in PDFs) starts with a BOM.
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      let out = "";
      for (let i = 2; i + 1 < bytes.length; i += 2)
        out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
      return out;
    }
    return decoder.decode(new Uint8Array(bytes));
  }
  let out = "";
  const step = cmap.bytes;
  for (let i = 0; i + step <= bytes.length; i += step) {
    const code = step === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
    out += cmap.map.get(code) ?? "";
  }
  return out;
}

function readLiteral(source: string, start: number): [string, number] {
  let out = "",
    depth = 1,
    i = start + 1;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "\\") {
      const next = source[i + 1];
      i += 1;
      if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === "t") out += "\t";
      else if (next === "b") out += "\b";
      else if (next === "f") out += "\f";
      else if (next === "\n") {
        // Line continuation: nothing to emit.
      } else if (next >= "0" && next <= "7") {
        let digits = next;
        while (
          digits.length < 3 &&
          source[i + 1] >= "0" &&
          source[i + 1] <= "7"
        ) {
          digits += source[i + 1];
          i += 1;
        }
        out += String.fromCharCode(parseInt(digits, 8) & 0xff);
      } else out += next ?? "";
    } else if (ch === "(") {
      depth += 1;
      out += ch;
    } else if (ch === ")") {
      depth -= 1;
      if (!depth) return [out, i];
      out += ch;
    } else out += ch;
  }
  return [out, i];
}

/** Walk one content stream and return its drawn text. */
function contentToText(
  source: string,
  pageFonts: Map<string, CMap | null>,
): string {
  const lines: string[] = [];
  let line = "",
    current: CMap | null = null,
    pending: string[] = [];
  const flush = () => {
    const value = line.replace(/[ \t]+/g, " ").trim();
    if (value) lines.push(value);
    line = "";
  };
  const add = (value: string) => {
    line += value;
  };
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") {
      const [value, end] = readLiteral(source, i);
      add(mapBytes(value, current));
      i = end;
      continue;
    }
    if (ch === "<" && source[i + 1] !== "<") {
      const end = source.indexOf(">", i + 1);
      if (end < 0) break;
      add(
        mapBytes(decoder.decode(hexToBytes(source.slice(i + 1, end))), current),
      );
      i = end;
      continue;
    }
    if (ch === "[") {
      pending = [];
      continue;
    }
    if (ch === "]") continue;
    if (/\s/.test(ch)) continue;
    if (ch === "(" || ch === "/") {
      if (ch === "/") {
        const name = source.slice(i + 1).match(/^[^\s/<>[\](){}%]+/)?.[0] ?? "";
        pending.push("/" + name);
        i += name.length;
      }
      continue;
    }
    if (/[0-9.+-]/.test(ch)) {
      const number = source.slice(i).match(/^[+-]?[0-9.]+/)?.[0] ?? ch;
      pending.push(number);
      i += number.length - 1;
      // In a TJ array a large negative kern is a missing space.
      if (line && Number(number) <= -120) add(" ");
      continue;
    }
    if (/[A-Za-z*'"]/.test(ch)) {
      const operator = source.slice(i).match(/^[A-Za-z*'"]+/)?.[0] ?? ch;
      i += operator.length - 1;
      if (operator === "Tf") {
        const name = pending.filter((token) => token.startsWith("/")).pop();
        current = name ? (pageFonts.get(name.slice(1)) ?? null) : null;
      } else if (operator === "T*" || operator === "'" || operator === '"')
        flush();
      else if (
        operator === "Td" ||
        operator === "TD" ||
        operator === "ET" ||
        operator === "Tm"
      )
        flush();
      pending = [];
      continue;
    }
  }
  flush();
  return lines.join("\n");
}

/** `name -> CMap` for every `/Font << /F1 7 0 R ... >>` reachable in the file. */
async function collectFonts(
  objects: Map<number, PdfObject>,
  dicts: string[],
): Promise<Map<string, CMap | null>> {
  const fonts = new Map<string, CMap | null>();
  for (const dict of dicts)
    for (const fontDict of dict.matchAll(/\/Font\s*<<([\s\S]*?)>>/g))
      for (const entry of fontDict[1].matchAll(
        /\/([A-Za-z0-9#._-]+)\s+(\d+)\s+\d+\s+R/g,
      )) {
        const font = objects.get(Number(entry[2]));
        if (!font || fonts.has(entry[1])) continue;
        const toUnicode = font.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
        const source = toUnicode
          ? await objectText(objects.get(Number(toUnicode[1])))
          : null;
        fonts.set(entry[1], source ? parseToUnicode(source) : null);
      }
  return fonts;
}

export async function extractPdfText(
  bytes: Uint8Array,
  maxChars = 40000,
): Promise<PdfText> {
  if (
    bytes.length < 8 ||
    !decoder.decode(bytes.subarray(0, 5)).startsWith("%PDF")
  )
    throw Error("Энэ файл PDF биш байна.");
  if (bytes.length > 40 * 1024 * 1024)
    throw Error("PDF хэт том байна. Дээд хэмжээ 40 MB.");
  const latin = decoder.decode(bytes),
    objects = readObjects(bytes, latin);
  const pageIds = [...objects.values()]
    .filter((object) => /\/Type\s*\/Page\b/.test(object.dict))
    .map((object) => object.id)
    .sort((a, b) => a - b);
  if (!pageIds.length)
    throw Error(
      "PDF-ээс хуудас олдсонгүй. Скан хийсэн PDF бол текстийг хуулж оруулна уу.",
    );
  const fonts = await collectFonts(objects, [
    ...[...objects.values()].map((object) => object.dict),
  ]);
  const chunks: string[] = [];
  let truncated = false,
    pages = 0;
  for (const id of pageIds) {
    const page = objects.get(id)!;
    pages += 1;
    const contentRefs = [
      ...refs(
        page.dict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] ?? "",
      ),
    ];
    const streams: string[] = [];
    for (const ref of contentRefs) {
      const text = await objectText(objects.get(ref));
      if (text) streams.push(text);
    }
    const text = streams
      .map((stream) => contentToText(stream, fonts))
      .join("\n")
      .trim();
    if (text) chunks.push(text);
    if (chunks.join("\n\n").length >= maxChars) {
      truncated = true;
      break;
    }
  }
  const text = chunks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text)
    throw Error(
      "PDF-ээс текст олдсонгүй. Скан хийсэн PDF бол текстийг хуулж оруулна уу.",
    );
  return { text: text.slice(0, maxChars), pages, truncated };
}
