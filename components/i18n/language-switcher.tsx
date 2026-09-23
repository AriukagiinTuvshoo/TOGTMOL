"use client";
import { useI18n } from "./language-provider";
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className={compact ? "language-switcher compact" : "language-switcher"} role="group" aria-label={t("lang.label")}>
      <button type="button" className={language === "mn" ? "active" : ""} aria-pressed={language === "mn"} onClick={() => setLanguage("mn")}>
        🇲🇳 <span>{t("lang.mongolian")}</span>
      </button>
      <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
        🇬🇧 <span>{t("lang.english")}</span>
      </button>
    </div>
  );
}
