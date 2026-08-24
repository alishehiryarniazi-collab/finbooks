import { AgingReport } from "./AgingReport";

export function ArAging() {
  return (
    <AgingReport
      endpoint="/reports/ar-aging"
      title="AR Aging"
      subtitle="Outstanding customer invoices by age"
      partyKey="customer"
      partyHeader="Customer"
    />
  );
}
