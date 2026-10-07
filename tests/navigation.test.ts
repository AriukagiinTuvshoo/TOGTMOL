import { describe, expect, it } from "vitest";
import { appHash, parseAppHash } from "@/lib/navigation";

describe("shareable app navigation", () => {
  it("opens known views and deep-linked records", () => {
    expect(parseAppHash("#/timer")).toEqual({
      view: "timer",
      recordId: null,
    });
    expect(parseAppHash("#/knowledge/note%2F42")).toEqual({
      view: "knowledge",
      recordId: "note/42",
    });
  });

  it("falls back safely for empty, unknown, and malformed links", () => {
    expect(parseAppHash("")).toEqual({ view: "overview", recordId: null });
    expect(parseAppHash("#/not-a-view/item")).toEqual({
      view: "overview",
      recordId: null,
    });
    expect(parseAppHash("#/knowledge/%E0%A4%A")).toEqual({
      view: "knowledge",
      recordId: null,
    });
  });

  it("creates encoded, shareable hashes", () => {
    expect(appHash("overview")).toBe("#/overview");
    expect(appHash("knowledge", "note/42 Монгол")).toBe(
      "#/knowledge/note%2F42%20%D0%9C%D0%BE%D0%BD%D0%B3%D0%BE%D0%BB",
    );
  });
});
