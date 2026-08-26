import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional short line under the title for context. */
  subtitle?: string;
  /** Optional leading glyph/emoji shown in a gradient tile beside the title. */
  icon?: ReactNode;
}

// Centered modal dialog over a dimmed backdrop. Aurora-themed: a soft gradient
// hairline at the top, an optional gradient icon tile, and a subtitle line.
export function Modal({ open, onClose, title, children, subtitle, icon }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl2 border border-white/10
          bg-gradient-to-b from-[#171b28] to-[#0d1018] p-6 shadow-2xl ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Aurora hairline across the top edge */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aurora-mint/70 to-transparent" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-mint/25 to-aurora-violet/25 text-lg ring-1 ring-white/10">
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
