import { LANGUAGE_LOCALE, type Language } from "./config";

export function locale(language: Language) {
  return LANGUAGE_LOCALE[language];
}

export function formatDate(
  value: Date | number | string,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(
    locale(language),
    options ?? { year: "numeric", month: "short", day: "numeric" },
  ).format(new Date(value));
}

export function formatMonth(value: Date | number | string, language: Language) {
  return new Intl.DateTimeFormat(locale(language), {
    year: "numeric",
    month: language === "mn" ? "numeric" : "long",
  }).format(new Date(value));
}

export function formatWeekday(
  value: Date | number | string,
  language: Language,
  short = false,
) {
  return new Intl.DateTimeFormat(locale(language), {
    weekday: short ? "short" : "long",
  }).format(new Date(value));
}

export function formatTime(value: Date | number | string, language: Language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(locale(language)).format(value);
}
