import type { ReactNode } from "react";

// Responsive grid wrapper used by the entity (cost center / project / tax rate) pages.
export function EntityGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

// A premium Aurora card for a single entity: gradient icon tile, optional badge,
// title and sub-line. Rendered as a button so hover-lift/glow only fire when it's
// actually clickable (disabled = view-only for non-editors).
export function EntityCard({
  icon,
  title,
  subtitle,
  badge,
  onClick,
  disabled,
  footer,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="glass group relative flex flex-col gap-4 p-5 text-left transition
        enabled:hover:-translate-y-0.5 enabled:hover:border-aurora-mint/40 enabled:hover:shadow-glow
        disabled:cursor-default"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-mint/20 to-aurora-violet/20 text-lg ring-1 ring-white/10">
          {icon}
        </span>
        {badge}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-white">{title}</p>
        {subtitle != null && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
      </div>
      {footer}
    </button>
  );
}

// Dashed "add another" tile shown at the end of a grid — discoverable + on theme.
export function AddCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed
        border-white/15 p-5 text-slate-400 transition hover:border-aurora-mint/50 hover:bg-white/[0.02] hover:text-white"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-lg transition group-hover:border-aurora-mint/50 group-hover:text-aurora-mint">
        +
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// Friendly empty state: gradient glyph, a line of guidance, and a call-to-action.
export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-mint/20 to-aurora-violet/20 text-3xl ring-1 ring-white/10">
        {icon}
      </span>
      <p className="max-w-xs text-sm text-slate-400">{message}</p>
      {action}
    </div>
  );
}
