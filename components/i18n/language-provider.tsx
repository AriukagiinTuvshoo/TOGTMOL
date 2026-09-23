"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("mn");

  useEffect(() => {
    const stored = readLanguage(window.localStorage);
    if (stored) setLanguageState(stored);
  }, []);

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
        isLanguage(event.newValue)
      ) {
        setLanguageState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    saveLanguage(
      next,
      typeof window === "undefined" ? undefined : window.localStorage,
    );
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
