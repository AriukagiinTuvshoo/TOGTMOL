export const LANGUAGE_STORAGE_KEY = "togtmol-language";
export const SUPPORTED_LANGUAGES = ["mn", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const LANGUAGE_LOCALE: Record<Language, string> = {
  mn: "mn-MN",
  en: "en-US",
};
export function isLanguage(value: unknown): value is Language {
  return value === "mn" || value === "en";
}
export function readLanguage(storage: Storage | undefined): Language | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}
export function saveLanguage(language: Language, storage: Storage | undefined) {
  if (!storage) return;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Private browsing/storage-disabled environments can still use the in-memory preference.
  }
}
