// Formatting helpers. Money values arrive from the API as fixed-2 strings
// (e.g. "1234.50") so we never do float math on the client.

export function money(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function shortDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function inputDate(value?: string | Date): string {
  const d = value ? new Date(value) : new Date();
  return d.toISOString().slice(0, 10); // yyyy-mm-dd for <input type=date>
}
