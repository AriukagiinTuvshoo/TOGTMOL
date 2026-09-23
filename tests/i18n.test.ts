import { describe, expect, it } from "vitest";
import { isLanguage, readLanguage, saveLanguage } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionary";
import { formatMonth, formatNumber } from "@/lib/i18n/format";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

describe("bilingual language system", () => {
  it("supports only Mongolian and English", () => {
    expect(isLanguage("mn")).toBe(true);
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("ja")).toBe(false);
  });

  it("persists the selected language independently from study data", () => {
    const storage = new MemoryStorage();
    expect(readLanguage(storage)).toBeNull();
    saveLanguage("en", storage);
    expect(readLanguage(storage)).toBe("en");
    saveLanguage("mn", storage);
    expect(readLanguage(storage)).toBe("mn");
  });

  it("translates the same product key in both languages", () => {
    expect(translate("mn", "nav.overview")).toBe("Миний өрөө");
    expect(translate("en", "nav.overview")).toBe("My Room");
    expect(translate("en", "timer.start")).toBe("Start");
  });

  it("formats locale-sensitive values from the selected language", () => {
    const date = new Date("2026-09-23T09:30:00Z");
    expect(formatMonth(date, "en")).toContain("2026");
    expect(formatMonth(date, "mn")).toContain("2026");
    expect(formatNumber(1234567, "en")).toBe("1,234,567");
  });
});
