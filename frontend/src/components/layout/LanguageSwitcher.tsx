import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, setLanguage } from "../../i18n";

// Explicit, user-chosen language picker (persisted). No auto-detection, so a language is
// only ever changed on purpose.
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
        aria-label="Language"
      >
        <span>🌐</span>
        <span className="hidden sm:inline">{current.label}</span>
      </button>
      {open && (
        <div className="absolute end-0 z-40 mt-1 w-40 rounded-xl border border-white/10 bg-aurora-bg2 p-1 shadow-2xl">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                l.code === current.code ? "bg-aurora-mint/15 text-white" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <span>{l.label}</span>
              {l.code === current.code && <span className="text-aurora-mint">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
