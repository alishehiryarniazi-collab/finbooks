// Formatting helpers. Money values arrive from the API as fixed-2 strings
// (e.g. "1234.50") so we never do float math on the client.

// The active currency is set once from the logged-in org (see AuthContext) so every
// money() call formats in the company's currency instead of a hardcoded USD.
let activeCurrency = "USD";
export function setActiveCurrency(code?: string | null) {
  if (code) activeCurrency = code;
}

export function money(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  try {
    return n.toLocaleString(undefined, { style: "currency", currency: activeCurrency });
  } catch {
    // Fall back if the code isn't a valid ISO currency.
    return `${activeCurrency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function shortDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function inputDate(value?: string | Date): string {
  const d = value ? new Date(value) : new Date();
  return d.toISOString().slice(0, 10); // yyyy-mm-dd for <input type=date>
}
