import { describe, expect, it } from "vitest";
import {
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  readLanguage,
  saveLanguage,
} from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionary";
import { formatMonth, formatNumber } from "@/lib/i18n/format";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("bilingual language system", () => {
  it("accepts only supported languages", () => {
    expect(isLanguage("mn")).toBe(true);
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("ja")).toBe(false);
  });

  it("persists a language independently from study data", () => {
    const storage = new MemoryStorage();
    expect(readLanguage(storage)).toBeNull();
    saveLanguage("en", storage);
    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(readLanguage(storage)).toBe("en");
  });

  it("translates shared UI keys", () => {
    expect(translate("mn", "nav.calendar")).toBe("Календарь");
    expect(translate("en", "nav.calendar")).toBe("Calendar");
    expect(translate("en", "assistant.thinking")).toBe("Bondook is thinking…");
  });

  it("formats month and numbers by the selected locale", () => {
    const date = new Date("2026-09-23T00:00:00Z");
    expect(formatMonth(date, "en")).toContain("September");
    expect(formatMonth(date, "mn")).toContain("9");
    expect(formatNumber(1234567, "en")).toContain(",");
  });
});
