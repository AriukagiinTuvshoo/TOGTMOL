/**
 * Minimal, dependency-free Anki text interchange.
 *
 * Anki's documented text format ("Notes in plain text", `.txt/.csv/.tsv`) is
 * what this module reads and writes. `.apkg` is a ZIP holding a SQLite
 * database (`collection.anki21`, itself zstd-compressed in modern exports), so
 * it cannot be read here without shipping a SQLite/zstd decoder; the UI asks
 * for the text export instead.
 */

export interface AnkiRow {
  front: string;
  back: string;
  tags: string[];
  deck?: string;
}

export interface AnkiParse {
  rows: AnkiRow[];
  delimiter: "\t" | "," | ";";
  skipped: number;
  html: boolean;
}

const MAX_FRONT = 4000;
const MAX_BACK = 10000;
const MAX_ROWS = 2000;

/** Convert Anki's HTML field content into the plain text this app stores. */
export function ankiHtmlToText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(div|p|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "· ")
    .replace(/<\s*(div|p|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/\[\s*sound:[^\]]*\]/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/gi, "&")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
}

/** RFC 4180 records: quoted fields may contain delimiters, quotes and newlines. */
function readRecords(lines: string[], delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i],
      last = i === lines.length - 1;
    for (let j = 0; j < line.length; j += 1) {
      const ch = line[j];
      if (quoted) {
        if (ch === '"') {
          if (line[j + 1] === '"') {
            field += '"';
            j += 1;
          } else quoted = false;
        } else field += ch;
      } else if (ch === '"' && !field.trim()) {
        quoted = true;
        field = "";
      } else if (ch === delimiter) {
        row.push(field);
        field = "";
      } else field += ch;
    }
    if (quoted) {
      // Unterminated quote: keep reading on the next line.
      field += "\n";
      continue;
    }
    row.push(field);
    if (!last || row.some((cell) => cell.trim())) records.push(row);
    row = [];
    field = "";
  }
  if (quoted || row.length || field) {
    row.push(field);
    records.push(row);
  }
  return records;
}

function detectDelimiter(lines: string[]): "\t" | "," | ";" {
  let tabs = 0,
    commas = 0,
    semicolons = 0;
  for (const line of lines) {
    tabs += (line.match(/\t/g) ?? []).length;
    commas += (line.match(/,/g) ?? []).length;
    semicolons += (line.match(/;/g) ?? []).length;
  }
  if (tabs >= commas && tabs >= semicolons && tabs > 0) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

const tagList = (value: string) =>
  value
    .split(/[\s,;]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter((tag) => tag && tag.length <= 60)
    .slice(0, 30);

/**
 * Parse an Anki plain-text export (or any front/back CSV/TSV).
 * Honors Anki's `#separator`, `#html`, `#tags column` and `#deck column`
 * headers, a "front/back/tags" header row, and `#` comment lines.
 */
export function parseAnkiText(input: string): AnkiParse {
  const lines = splitLines(input);
  let html = false,
    tagsColumn = -1,
    deckColumn = -1,
    declared: "\t" | "," | ";" | null = null;
  const body: string[] = [];
  for (const line of lines) {
    const meta = line.match(/^#(\w[\w ]*):(.*)$/);
    if (meta) {
      const key = meta[1].trim().toLowerCase(),
        value = meta[2].trim();
      if (key === "separator")
        declared = /tab/i.test(value)
          ? "\t"
          : /semicolon/i.test(value)
            ? ";"
            : ",";
      else if (key === "html") html = !/^false$/i.test(value);
      else if (key === "tags column") tagsColumn = Number(value) - 1;
      else if (key === "deck column") deckColumn = Number(value) - 1;
      continue;
    }
    if (line.startsWith("#")) continue; // Comment line such as "#notes: 42".
    body.push(line);
  }
  const delimiter = declared ?? detectDelimiter(body);
  const records = readRecords(body, delimiter);
  const header = records[0] ?? [];
  const headerLooksLikeNames = header.some((cell) =>
    /^(front|question|term|асуулт|back|answer|definition|хариулт|tags|шошго|deck|багц)$/i.test(
      cell.trim(),
    ),
  );
  if (headerLooksLikeNames) {
    const find = (names: RegExp) =>
      header.findIndex((cell) => names.test(cell.trim()));
    const tags = find(/^(tags|шошго)$/i),
      deck = find(/^(deck|багц)$/i);
    if (tags >= 0) tagsColumn = tags;
    if (deck >= 0) deckColumn = deck;
  }
  const rows: AnkiRow[] = [];
  let skipped = 0;
  for (const record of records.slice(headerLooksLikeNames ? 1 : 0)) {
    if (rows.length >= MAX_ROWS) {
      skipped += 1;
      continue;
    }
    const cells = record.map((cell) => cell.trim());
    const frontRaw = cells[0] ?? "";
    const backParts: string[] = [];
    for (let i = 1; i < cells.length; i += 1) {
      if (i === tagsColumn || i === deckColumn) continue;
      if (cells[i]) backParts.push(cells[i]);
    }
    const backRaw = backParts.join("\n\n");
    if (!frontRaw || !backRaw) {
      skipped += 1;
      continue;
    }
    const front = (html ? ankiHtmlToText(frontRaw) : frontRaw).slice(
      0,
      MAX_FRONT,
    );
    const back = (html ? ankiHtmlToText(backRaw) : backRaw).slice(0, MAX_BACK);
    if (!front.trim() || !back.trim()) {
      skipped += 1;
      continue;
    }
    const deck = deckColumn >= 0 ? cells[deckColumn] : undefined;
    rows.push({
      front,
      back,
      tags: tagsColumn >= 0 ? tagList(cells[tagsColumn] ?? "") : [],
      ...(deck ? { deck: deck.slice(0, 180) } : {}),
    });
  }
  return { rows, delimiter, skipped, html };
}

export interface ExportCard {
  front: string;
  back: string;
  tags: string[];
  deck: string;
}

const needsQuotes = (value: string, delimiter: string) =>
  value.includes(delimiter) || /["\n\r]/.test(value);
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** Anki-flavored TSV: `#html:true`, newlines as `<br>`, no quoting. */
export function toAnkiTsv(cards: ExportCard[]): string {
  const cell = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r?\n/g, "<br>")
      .replace(/\t/g, " ");
  const lines = [
    "#separator:tab",
    "#html:true",
    "#tags column:3",
    "#deck column:4",
    ...cards.map((card) =>
      [card.front, card.back, card.tags.join(" "), card.deck]
        .map(cell)
        .join("\t"),
    ),
  ];
  return lines.join("\n") + "\n";
}

/** RFC 4180 CSV for spreadsheets (Anki users should use the TSV export). */
export function toCsv(cards: ExportCard[]): string {
  const lines = ["front,back,tags,deck"];
  for (const card of cards) {
    const cells = [card.front, card.back, card.tags.join(" "), card.deck];
    lines.push(
      cells
        .map((value) =>
          needsQuotes(value, ",")
            ? quote(value)
            : value.replace(/\r?\n/g, "\n"),
        )
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
