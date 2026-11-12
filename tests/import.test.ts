import { describe, expect, it } from "vitest";
import { cardKey, importCards } from "@/lib/knowledge/actions";
import { parseAnkiText, toAnkiTsv } from "@/lib/knowledge/anki";
import { knowledgeFixture } from "./knowledge-fixtures";
import type { Flashcard, FlashcardDeck } from "@/types/knowledge";
import type { StudyData } from "@/types/study";

const cardsIn = (data: StudyData, deckId?: string) =>
  data.knowledge.filter(
    (r): r is Flashcard =>
      r.kind === "card" && !r.deletedAt && (!deckId || r.deckId === deckId),
  );
const decksIn = (data: StudyData) =>
  data.knowledge.filter((r): r is FlashcardDeck => r.kind === "deck");

describe("importCards", () => {
  it("creates a deck and one card per row", () => {
    const next = importCards(
      [
        {
          front: "ATP гэж юу вэ?",
          back: "Энергийн мөнгөн тэмдэгт",
          tags: ["bio"],
        },
        { front: "Митохондри", back: "ATP үйлдвэрлэгч" },
      ],
      { title: "Биологи", subjectId: "math", today: "2026-09-15" },
    )(knowledgeFixture());
    const decks = decksIn(next),
      deck = decks.find((d) => d.title === "Биологи")!;
    expect(deck).toBeTruthy();
    expect(deck.subjectId).toBe("math");
    const cards = cardsIn(next, deck.id);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      front: "ATP гэж юу вэ?",
      back: "Энергийн мөнгөн тэмдэгт",
      tags: ["bio"],
      schedule: { repetitions: 0, interval: 0, dueOn: "2026-09-15" },
    });
  });

  it("skips questions that already exist in the target deck", () => {
    const first = importCards([{ front: "АТФ", back: "энерги" }], {
      title: "Биологи",
      today: "2026-09-15",
    })(knowledgeFixture());
    const again = importCards(
      [
        { front: "  атф ", back: "өөр хариулт" },
        { front: "Шинэ", back: "карт" },
      ],
      {
        title: "Игноригдох",
        deckId: decksIn(first).find((d) => d.title === "Биологи")!.id,
        today: "2026-09-15",
      },
    )(first);
    const deck = decksIn(again).find((d) => d.title === "Биологи")!;
    expect(decksIn(again)).toHaveLength(decksIn(first).length);
    expect(cardsIn(again, deck.id).map((c) => c.front)).toEqual([
      "АТФ",
      "Шинэ",
    ]);
  });

  it("merges deck tags into every imported card", () => {
    const next = importCards([{ front: "Q", back: "A" }], {
      title: "Сэдэв",
      tags: ["импорт", "2026"],
      today: "2026-09-15",
    })(knowledgeFixture());
    const deck = decksIn(next).find((d) => d.title === "Сэдэв")!;
    expect(cardsIn(next, deck.id)[0].tags).toEqual(["импорт", "2026"]);
  });

  it("rejects empty, oversized and unknown-deck imports", () => {
    const data = knowledgeFixture();
    expect(() =>
      importCards([], { title: "X", today: "2026-09-15" })(data),
    ).toThrow(/олдсонгүй/);
    expect(() =>
      importCards(
        Array.from({ length: 2001 }, (_, i) => ({
          front: `Q${i}`,
          back: "A",
        })),
        { title: "X", today: "2026-09-15" },
      )(data),
    ).toThrow(/2000/);
    expect(() =>
      importCards([{ front: "Q", back: "A" }], {
        title: "X",
        deckId: "missing",
        today: "2026-09-15",
      })(data),
    ).toThrow(/Багц олдсонгүй/);
    expect(() =>
      importCards([{ front: "Q", back: "A" }], {
        title: "   ",
        today: "2026-09-15",
      })(data),
    ).toThrow(/нэр/);
  });

  it("keeps imported cards out of the review queue until their due date", () => {
    const next = importCards([{ front: "Q", back: "A" }], {
      title: "Шинэ багц",
      today: "2026-09-15",
    })(knowledgeFixture());
    const deck = decksIn(next).find((d) => d.title === "Шинэ багц")!;
    expect(cardsIn(next, deck.id)[0].schedule.dueOn).toBe("2026-09-15");
  });

  it("round-trips an exported Anki deck back into the app", () => {
    const data = knowledgeFixture(),
      existing = cardsIn(data),
      tsv = toAnkiTsv(
        existing.map((c) => ({
          front: c.front,
          back: c.back,
          tags: c.tags,
          deck: "Алгебрын карт",
        })),
      ),
      parsed = parseAnkiText(tsv),
      next = importCards(parsed.rows, {
        title: "Дахин импорт",
        today: "2026-09-15",
      })(data);
    const deck = decksIn(next).find((d) => d.title === "Дахин импорт")!;
    expect(cardsIn(next, deck.id).map((c) => c.front)).toEqual(
      existing.map((c) => c.front),
    );
    expect(cardKey(" X  + 2 ")).toBe(cardKey("x + 2"));
  });
});
