import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ur from "./ur.json";

// Supported languages. `dir` drives RTL. Add more entries here (with a matching JSON file)
// to offer more languages.
export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" as const },
  { code: "ur", label: "اردو", dir: "rtl" as const },
];

const STORAGE_KEY = "finbooks_lang";

// The language is chosen explicitly by the user and remembered — we do NOT auto-detect from
// the browser, so a user's screen never silently switches or mixes languages.
function initialLang(): string {
  const saved = localStorage.getItem(STORAGE_KEY);
  return LANGUAGES.some((l) => l.code === saved) ? saved! : "en";
}

// Apply text direction (RTL/LTR) + lang attribute to the document.
export function applyDir(lang: string) {
  const l = LANGUAGES.find((x) => x.code === lang) ?? LANGUAGES[0];
  document.documentElement.dir = l.dir;
  document.documentElement.lang = lang;
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ur: { translation: ur } },
  lng: initialLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

applyDir(initialLang());

// Change and persist the active language, and update the document direction.
export function setLanguage(lang: string) {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18n.changeLanguage(lang);
  applyDir(lang);
}

export default i18n;
