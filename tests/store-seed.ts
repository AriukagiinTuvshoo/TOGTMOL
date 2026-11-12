import { Repository } from "@/lib/persistence/repository";
import { recordBase } from "@/lib/knowledge/actions";
import { NOW } from "./fixtures";
import { knowledgeFixture } from "./knowledge-fixtures";
import type { Flashcard, FlashcardDeck } from "@/types/knowledge";
import type { StudyData } from "@/types/study";

/** Write a dataset as the guest namespace before rendering the app or a view. */
export async function seedGuestStore(
  data: StudyData = knowledgeFixture(),
): Promise<StudyData> {
  await new Repository().save("guest", data, 0);
  return data;
}

/**
 * Guest dataset with `perDeck` fresh cards (due today) in each of `deckNames`.
 * Cards are created in order, so the first deck's cards come first in a queue.
 */
export function dataWithFreshCards(
  deckNames: string[] = ["Багц A", "Багц B"],
  perDeck = 6,
  extras: Record<string, unknown> = {},
): StudyData {
  const base = knowledgeFixture(),
    decks: FlashcardDeck[] = deckNames.map((name, index) => ({
      ...recordBase(name, "math", [], NOW + index),
      id: `seed-deck-${index}`,
      kind: "deck",
      description: "Тестийн багц",
    })),
    cards: Flashcard[] = decks.flatMap((deck, deckIndex) =>
      Array.from({ length: perDeck }, (_, i) => ({
        ...recordBase(
          `${deck.title} карт ${i + 1}`,
          "math",
          [],
          NOW + deckIndex * 1000 + i,
        ),
        id: `${deck.id}-card-${i}`,
        kind: "card",
        deckId: deck.id,
        front: `${deck.title}: асуулт ${i + 1}`,
        back: `хариулт ${i + 1}`,
        schedule: {
          repetitions: 0,
          interval: 0,
          ease: 2.5,
          dueOn: "2026-09-15",
        },
      })),
    );
  return {
    ...base,
    // The fixture card would add one more fresh card to every queue.
    knowledge: [
      ...base.knowledge.filter((r) => r.kind !== "card"),
      ...decks,
      ...cards,
    ],
    settings: {
      ...base.settings,
      extras: { ...base.settings.extras, newCardsPerDay: 0, ...extras },
    },
  };
}
