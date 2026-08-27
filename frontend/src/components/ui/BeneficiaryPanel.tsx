import { useState } from "react";
import { useTranslation } from "react-i18next";

// The payment fields a customer/vendor can carry (all optional).
type Party = {
  paymentMethod?: string | null;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  raastId?: string | null;
};

const METHOD_KEY: Record<string, string> = {
  BANK: "party.bank",
  JAZZCASH: "party.jazzcash",
  EASYPAISA: "party.easypaisa",
  CASH: "party.cash",
  CHEQUE: "party.cheque",
};

// Show only the last 4 digits on screen; the copy button still copies the full value.
function mask(v: string) {
  const s = v.replace(/\s+/g, "");
  return s.length > 4 ? `•••• ${s.slice(-4)}` : s;
}

// Read-only "where to pay" card shown on the pay screen — masks sensitive numbers but lets the
// user copy the full value to paste into their bank app. The app never moves money itself.
export function BeneficiaryPanel({ party }: { party?: Party | null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const hasAny =
    party &&
    (party.paymentMethod || party.bankName || party.accountTitle || party.accountNumber || party.iban || party.raastId);

  if (!hasAny) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">
        {t("party.noDetails")}
      </p>
    );
  }

  function copy(value: string, id: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const isWallet = party!.paymentMethod === "JAZZCASH" || party!.paymentMethod === "EASYPAISA";

  // Render helper (not a component) — a labelled row, optionally masked and copyable.
  const row = (
    label: string,
    value?: string | null,
    opts: { copyable?: boolean; secret?: boolean; id?: string } = {},
  ) =>
    value ? (
      <div key={label} className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-slate-200">{opts.secret ? mask(value) : value}</span>
          {opts.copyable && (
            <button
              type="button"
              onClick={() => copy(value, opts.id!)}
              className="text-xs text-aurora-mint transition hover:brightness-110"
            >
              {copied === opts.id ? t("party.copied") : t("party.copy")}
            </button>
          )}
        </span>
      </div>
    ) : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">{t("party.payTo")}</p>
      <div className="flex flex-col gap-1.5">
        {party!.paymentMethod &&
          row(t("party.method"), t(METHOD_KEY[party!.paymentMethod] ?? party!.paymentMethod))}
        {row(t("party.bankName"), party!.bankName)}
        {row(t("party.accountTitle"), party!.accountTitle)}
        {row(isWallet ? t("party.mobileNumber") : t("party.accountNumber"), party!.accountNumber, {
          copyable: true,
          secret: true,
          id: "acct",
        })}
        {row(t("party.iban"), party!.iban, { copyable: true, secret: true, id: "iban" })}
        {row(t("party.raastId"), party!.raastId, { copyable: true, id: "raast" })}
      </div>
    </div>
  );
}
