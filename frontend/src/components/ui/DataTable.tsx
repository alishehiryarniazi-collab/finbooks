import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  // Cell renderer; return any node. `align` right-aligns numeric columns.
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
}

// Reusable table styled for the glass/dark theme. Scrolls horizontally on small screens.
export function DataTable<T>({ columns, rows, keyOf, onRowClick, empty = "No records yet." }: Props<T>) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-slate-400">
            {columns.map((c, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyOf(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-white/5 transition ${
                onRowClick ? "cursor-pointer hover:bg-white/[0.04]" : ""
              }`}
            >
              {columns.map((c, i) => (
                <td key={i} className={`px-3 py-2.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
