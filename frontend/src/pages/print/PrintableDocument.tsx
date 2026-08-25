import { money, shortDate } from "../../lib/format";

export interface PrintLine {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
  lineTotal: string;
}

export interface PrintDocProps {
  kind: "INVOICE" | "BILL";
  orgName: string;
  orgAddress?: string | null;
  orgPhone?: string | null;
  orgEmail?: string | null;
  logoDataUrl?: string | null;
  number: string;
  status: string;
  issueLabel: string;
  issueDate: string;
  dueDate: string;
  partyHeading: string;
  party: { name: string; email?: string | null; phone?: string | null; address?: string | null };
  lines: PrintLine[];
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  notes?: string | null;
  onBack: () => void;
}

// A clean, printer-friendly invoice/bill on white "paper". The action bar is marked
// .no-print so only the document prints (browser's Print dialog → Save as PDF).
export function PrintableDocument(props: PrintDocProps) {
  const balance = (Number(props.total) - Number(props.amountPaid)).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-100 py-8 text-slate-900">
      {/* Action bar (screen only) */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <button
          onClick={props.onBack}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* The printable sheet */}
      <div className="print-sheet mx-auto max-w-3xl rounded-xl bg-white p-10 shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div className="flex items-start gap-3">
            {props.logoDataUrl && (
              <img src={props.logoDataUrl} alt="" className="h-14 w-14 shrink-0 object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{props.orgName}</h1>
              {props.orgAddress && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{props.orgAddress}</p>}
              {(props.orgEmail || props.orgPhone) && (
                <p className="text-sm text-slate-600">
                  {[props.orgEmail, props.orgPhone].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold uppercase tracking-tight text-slate-800">{props.kind}</h2>
            <p className="mt-1 text-sm text-slate-500">#{props.number}</p>
            <span className="mt-2 inline-block rounded-full border border-slate-300 px-3 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">
              {props.status}
            </span>
          </div>
        </div>

        {/* Party + dates */}
        <div className="mt-6 flex justify-between gap-6">
          <div className="max-w-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{props.partyHeading}</p>
            <p className="mt-1 font-semibold text-slate-900">{props.party.name}</p>
            {props.party.address && <p className="whitespace-pre-line text-sm text-slate-600">{props.party.address}</p>}
            {props.party.email && <p className="text-sm text-slate-600">{props.party.email}</p>}
            {props.party.phone && <p className="text-sm text-slate-600">{props.party.phone}</p>}
          </div>
          <div className="text-right text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-slate-400">{props.issueLabel}</span>
              <span className="font-medium text-slate-700">{shortDate(props.issueDate)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-8">
              <span className="text-slate-400">Due date</span>
              <span className="font-medium text-slate-700">{shortDate(props.dueDate)}</span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price</th>
              <th className="py-2 text-right font-semibold">Tax %</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {props.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2.5 text-slate-800">{l.description}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">{Number(l.quantity)}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">{money(l.unitPrice)}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">{Number(l.taxRatePercent)}%</td>
                <td className="py-2.5 text-right tabular-nums text-slate-800">{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <Row label="Subtotal" value={money(props.subtotal)} />
            <Row label="Tax" value={money(props.taxTotal)} />
            <div className="border-t border-slate-200 pt-1.5">
              <Row label="Total" value={money(props.total)} strong />
            </div>
            <Row label="Paid" value={money(props.amountPaid)} />
            <div className="rounded-lg bg-slate-900 px-3 py-2 text-white">
              <Row label="Balance due" value={money(balance)} strong invert />
            </div>
          </div>
        </div>

        {/* Notes */}
        {props.notes && (
          <div className="mt-8 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{props.notes}</p>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">
          Thank you for your business. · Generated by FinBooks
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, invert }: { label: string; value: string; strong?: boolean; invert?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""} ${invert ? "text-white" : strong ? "text-slate-900" : "text-slate-500"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
