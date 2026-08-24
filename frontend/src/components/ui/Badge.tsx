// Status pill with a color per document/entry status.
const STYLES: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  POSTED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  SENT: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  OPEN: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  PARTIAL: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DRAFT: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  VOID: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.DRAFT;
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
