"use client";

import { Languages } from "lucide-react";
import { useI18n } from "./i18n-provider";

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === "zh" ? "en" : "zh";

  return (
    <button
      type="button"
      className="languageSwitch"
      aria-label={t("app.locale.aria")}
      title={t("app.locale.aria")}
      onClick={() => setLocale(nextLocale)}
    >
      <Languages size={15} strokeWidth={2.2} aria-hidden="true" />
      <span>{locale === "zh" ? t("app.locale.en") : t("app.locale.zh")}</span>
    </button>
  );
}
