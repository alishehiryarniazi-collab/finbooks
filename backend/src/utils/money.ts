import { Prisma } from "@prisma/client";

// Money helpers built on Prisma.Decimal so we never do math on JS floats
// (0.1 + 0.2 !== 0.3). All amounts flow through these functions.

export type Money = Prisma.Decimal;

export const D = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

export const ZERO = D(0);

// Round to 2 decimal places using banker's-safe half-up rounding.
export function round2(value: Prisma.Decimal.Value): Prisma.Decimal {
  return D(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: Prisma.Decimal.Value[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(D(v)), ZERO);
}

// Two amounts are "equal money" if they match to the cent.
export function moneyEquals(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean {
  return round2(a).equals(round2(b));
}
