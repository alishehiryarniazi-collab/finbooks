import { PartyManager } from "../PartyManager";

export function Customers() {
  return <PartyManager resource="customers" singular="Customer" plural="Customers" dataKey="customers" />;
}
