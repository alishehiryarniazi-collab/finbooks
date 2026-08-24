// Simple centered loading spinner in the mint accent.
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-aurora-mint" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
