import type { TFunction } from "i18next";
import type { RecurringFrequency } from "./types";

// Human label for a recurrence, e.g. "Monthly" or "Every 2 weeks".
export function frequencyLabel(t: TFunction, freq: RecurringFrequency, interval: number): string {
  if (interval <= 1) return t(`recur.simple.${freq}`);
  return t("recur.everyN", { n: interval, unit: t(`recur.unit.${freq}`) });
}
