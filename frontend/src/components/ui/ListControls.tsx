// Reusable search box + optional status filter pills for list pages.
export function ListControls({
  query,
  onQuery,
  placeholder,
  statuses,
  status,
  onStatus,
  right,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  statuses?: string[];
  status?: string;
  onStatus?: (s: string) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        className="input max-w-xs"
        placeholder={placeholder ?? "Search…"}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      {statuses && (
        <div className="flex flex-wrap gap-1.5">
          {["ALL", ...statuses].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatus?.(s)}
              className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                status === s ? "bg-aurora-mint/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {s === "ALL" ? "All" : s.toLowerCase()}
            </button>
          ))}
        </div>
      )}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
