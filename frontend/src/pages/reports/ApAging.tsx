import { AgingReport } from "./AgingReport";

export function ApAging() {
  return (
    <AgingReport
      endpoint="/reports/ap-aging"
      title="AP Aging"
      subtitle="Outstanding vendor bills by age"
      partyKey="vendor"
      partyHeader="Vendor"
    />
  );
}
