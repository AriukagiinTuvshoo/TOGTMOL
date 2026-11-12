import { describe, expect, it } from "vitest";
import { ROOM_THEMES } from "@/lib/world/room-themes";
import type { DesignTheme } from "@/types/study";

/**
 * WCAG 2.1 AA body text needs 4.5:1. Muted and accent text is used at small
 * sizes across every room theme, so each palette is checked against every
 * background those tokens can sit on (cards, muted cards, accent chips,
 * yellow highlights). The browser audit that drove the fix found 13 failures
 * in the cozy theme alone; a palette-level guard keeps the other themes from
 * drifting the same way.
 */
const TEXT_BACKGROUNDS = [
  "bg",
  "surface",
  "surfaceMuted",
  "accentSoft",
  "yellowSoft",
] as const;

type Palette = Record<string, string>;

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const themes = Object.entries(ROOM_THEMES) as [
  DesignTheme,
  (typeof ROOM_THEMES)[DesignTheme],
][];

describe("room theme contrast", () => {
  it.each(themes)(
    "%s light palette keeps muted and accent text readable",
    (_theme, room) => {
      const palette = room.ui.light as unknown as Palette;
      const backgrounds = TEXT_BACKGROUNDS.map((key) => palette[key]).filter(
        (value): value is string =>
          typeof value === "string" && value.startsWith("#"),
      );
      expect(backgrounds.length).toBeGreaterThan(0);

      for (const token of ["muted", "accent"] as const) {
        const text = palette[token];
        expect(text, `${token} is defined`).toMatch(/^#/);
        for (const background of backgrounds) {
          const ratio = contrast(text, background);
          expect(
            ratio,
            `${_theme} ${token} ${text} on ${background} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );
});
