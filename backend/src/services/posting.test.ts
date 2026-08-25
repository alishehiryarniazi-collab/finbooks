import { describe, it, expect } from "vitest";
import { validateBalanced, type PostingLine } from "./posting";

// These tests lock down the core accounting invariant: a journal entry is only legal
// when debits === credits and every line is well-formed. This is the rule the whole
// system depends on, so it's the most important thing to test.

describe("validateBalanced", () => {
  it("accepts a balanced two-line entry", () => {
    const lines: PostingLine[] = [
      { accountId: "a", debit: 100 },
      { accountId: "b", credit: 100 },
    ];
    const totals = validateBalanced(lines);
    expect(totals.totalDebit.toFixed(2)).toBe("100.00");
    expect(totals.totalCredit.toFixed(2)).toBe("100.00");
  });

  it("accepts a balanced multi-line entry (split across accounts)", () => {
    const lines: PostingLine[] = [
      { accountId: "ar", debit: 117 },
      { accountId: "sales", credit: 100 },
      { accountId: "tax", credit: 17 },
    ];
    expect(() => validateBalanced(lines)).not.toThrow();
  });

  it("rejects an unbalanced entry", () => {
    const lines: PostingLine[] = [
      { accountId: "a", debit: 100 },
      { accountId: "b", credit: 90 },
    ];
    expect(() => validateBalanced(lines)).toThrow(/not balanced/i);
  });

  it("rejects fewer than two lines", () => {
    expect(() => validateBalanced([{ accountId: "a", debit: 100 }])).toThrow(/two lines/i);
  });

  it("rejects a line with both a debit and a credit", () => {
    const lines: PostingLine[] = [
      { accountId: "a", debit: 100, credit: 100 },
      { accountId: "b", credit: 100 },
    ];
    expect(() => validateBalanced(lines)).toThrow(/both a debit and a credit/i);
  });

  it("rejects a line with neither a debit nor a credit", () => {
    const lines: PostingLine[] = [{ accountId: "a" }, { accountId: "b", credit: 100 }];
    expect(() => validateBalanced(lines)).toThrow(/debit or a credit/i);
  });

  it("rejects negative amounts", () => {
    const lines: PostingLine[] = [
      { accountId: "a", debit: -100 },
      { accountId: "b", credit: -100 },
    ];
    expect(() => validateBalanced(lines)).toThrow(/negative/i);
  });

  it("treats cent-level rounding as balanced", () => {
    // 33.33 * 3 = 99.99, offset by 99.99 — must balance to the cent.
    const lines: PostingLine[] = [
      { accountId: "a", debit: 33.33 },
      { accountId: "b", debit: 33.33 },
      { accountId: "c", debit: 33.33 },
      { accountId: "d", credit: 99.99 },
    ];
    expect(() => validateBalanced(lines)).not.toThrow();
  });
});
