"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  isLanguage,
  readLanguage,
  saveLanguage,
  type Language,
} from "@/lib/i18n/config";
import { translate, type TranslationKey } from "@/lib/i18n/dictionary";
import {
  formatDate,
  formatMonth,
  formatNumber,
  formatTime,
  formatWeekday,
} from "@/lib/i18n/format";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
  formatDate: (
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatMonth: (value: Date | number | string) => string;
  formatWeekday: (value: Date | number | string, short?: boolean) => string;
  formatTime: (value: Date | number | string) => string;
  formatNumber: (value: number) => string;
};

const Context = createContext<LanguageContextValue | null>(null);
const listeners = new Set<() => void>();

function currentLanguage(): Language {
  if (typeof window === "undefined") return "mn";
  return readLanguage(window.localStorage) ?? "mn";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerLanguage() {
  return "mn" as const;
}

function notifyLanguageChange() {
  for (const listener of listeners) listener();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(
    subscribe,
    currentLanguage,
    getServerLanguage,
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    document.documentElement.dir = "ltr";
    document.title =
      language === "en"
        ? "TOGTMOL — Study with Bondook"
        : "Тогтмол — Бондооктой хамт суралцъя";
  }, [language]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === "togtmol-language" &&
        (event.newValue === null || isLanguage(event.newValue))
      ) {
        notifyLanguageChange();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    saveLanguage(
      next,
      typeof window === "undefined" ? undefined : window.localStorage,
    );
    notifyLanguageChange();
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => translate(language, key),
      formatDate: (value, options) => formatDate(value, language, options),
      formatMonth: (value) => formatMonth(value, language),
      formatWeekday: (value, short) =>
        formatWeekday(value, language, short),
      formatTime: (value) => formatTime(value, language),
      formatNumber: (value) => formatNumber(value, language),
    }),
    [language, setLanguage],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n() {
  const value = useContext(Context);
  if (!value) throw Error("LanguageProvider is required.");
  return value;
}
