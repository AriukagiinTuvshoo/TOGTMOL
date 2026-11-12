import { describe, expect, it } from "vitest";
import {
  ankiHtmlToText,
  parseAnkiText,
  toAnkiTsv,
  toCsv,
} from "@/lib/knowledge/anki";

describe("Anki text import", () => {
  it("reads Anki's tab export with its meta headers", () => {
    const parsed = parseAnkiText(
      [
        "#separator:tab",
        "#html:true",
        "#tags column:3",
        "#notes: 3",
        "What is ATP?\tEnergy currency<br>of the cell\tbiology mitochondria",
        "<b>Mitochondria</b>\tPowerhouse &amp; ATP\tbiology",
        "Empty\t\t",
        "",
      ].join("\n"),
    );
    expect(parsed.delimiter).toBe("\t");
    expect(parsed.html).toBe(true);
    expect(parsed.rows).toEqual([
      {
        front: "What is ATP?",
        back: "Energy currency\nof the cell",
        tags: ["biology", "mitochondria"],
      },
      {
        front: "Mitochondria",
        back: "Powerhouse & ATP",
        tags: ["biology"],
      },
    ]);
    expect(parsed.skipped).toBe(1);
  });

  it("handles quoted CSV with embedded commas, quotes and newlines", () => {
    const parsed = parseAnkiText(
      'front,back,tags,deck\n"Q1, and more","line one\nline two",tag1,Deck A\n"say ""hi""","b",,\n',
    );
    expect(parsed.delimiter).toBe(",");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({
      front: "Q1, and more",
      back: "line one\nline two",
      tags: ["tag1"],
      deck: "Deck A",
    });
    expect(parsed.rows[1].front).toBe('say "hi"');
    expect(parsed.rows[1].deck).toBeUndefined();
  });

  it("detects semicolon files and keeps extra fields in the answer", () => {
    const parsed = parseAnkiText(
      "Талбай 1;Талбай 2;Талбай 3\nАсуулт;Хариулт;Тайлбар\n",
    );
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1]).toEqual({
      front: "Асуулт",
      back: "Хариулт\n\nТайлбар",
      tags: [],
    });
  });

  it("counts unusable rows and ignores blank input", () => {
    expect(parseAnkiText("   \n\n").rows).toHaveLength(0);
    const parsed = parseAnkiText("front\tback\nonly front\t\n\tback\n");
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.skipped).toBe(2);
  });

  it("cleans Anki HTML, media references and entities", () => {
    expect(
      ankiHtmlToText(
        "A <b>bold</b> answer<br>next line [sound:abc.mp3]<div>para</div> &lt;tag&gt; &nbsp;end &#1072;",
      ),
    ).toBe("A bold answer\nnext line\npara\n<tag>  end а");
  });
});

describe("Anki text export", () => {
  const cards = [
    {
      front: "What is ATP?",
      back: "Energy currency\nof the cell",
      tags: ["biology", "atp"],
      deck: "Биологи",
    },
    {
      front: 'A "quoted", question',
      back: "Back",
      tags: [],
      deck: "Биологи",
    },
  ];

  it("writes a TSV that its own parser reads back", () => {
    const tsv = toAnkiTsv(cards);
    expect(tsv.split("\n")[0]).toBe("#separator:tab");
    expect(tsv).toContain("#html:true");
    const parsed = parseAnkiText(tsv);
    expect(parsed.rows).toEqual([
      {
        front: "What is ATP?",
        back: "Energy currency\nof the cell",
        tags: ["biology", "atp"],
        deck: "Биологи",
      },
      {
        front: 'A "quoted", question',
        back: "Back",
        tags: [],
        deck: "Биологи",
      },
    ]);
  });

  it("never leaves a raw tab or newline inside a TSV cell", () => {
    const tsv = toAnkiTsv([
      { front: "a\tb", back: "c\td", tags: ["t"], deck: "d" },
    ]);
    const row = tsv.split("\n")[4];
    expect(row.split("\t")).toHaveLength(4);
  });

  it("writes RFC 4180 CSV with quotes", () => {
    const csv = toCsv(cards);
    expect(csv.split("\r\n")[0]).toBe("front,back,tags,deck");
    expect(csv).toContain('"Energy currency\nof the cell"');
    expect(csv).toContain('"A ""quoted"", question"');
    const parsed = parseAnkiText(csv);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1].front).toBe('A "quoted", question');
    expect(parsed.rows[0].back).toBe("Energy currency\nof the cell");
  });

  it("escapes HTML so Anki keeps the line breaks", () => {
    const tsv = toAnkiTsv([
      { front: "<b>x</b>", back: "y\nz", tags: [], deck: "d" },
    ]);
    expect(tsv).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(tsv).toContain("y<br>z");
  });
});
