import type { Transaction } from "@/lib/types";

export interface CashBacksolveResult {
  targetEndCashBalance: number;
  netCashflow: number;
  computedStartingBalance: number;
  endingCashBalance: number;
  lastTransactionDate: string | null;
  usesSignedAmounts: boolean;
}

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function inferSignedAmount(txn: Transaction): number {
  const absoluteAmount = Math.abs(txn.amount);

  if (txn.type === "debit") {
    return -absoluteAmount;
  }

  if (txn.type === "credit") {
    return absoluteAmount;
  }

  return txn.amount;
}

export function computeNetCashflow(transactions: Transaction[]): {
  netCashflow: number;
  usesSignedAmounts: boolean;
} {
  const usesSignedAmounts = transactions.some((txn) => txn.amount < 0);

  const netCashflow = transactions.reduce((sum, txn) => {
    return sum + (usesSignedAmounts ? txn.amount : inferSignedAmount(txn));
  }, 0);

  return {
    netCashflow: roundToCents(netCashflow),
    usesSignedAmounts,
  };
}

function getLastTransactionDate(transactions: Transaction[]): string | null {
  if (transactions.length === 0) {
    return null;
  }

  return transactions.reduce((latest, txn) => {
    return txn.date > latest ? txn.date : latest;
  }, transactions[0].date);
}

export function computeStartingBalanceForTargetEnd(
  transactions: Transaction[],
  targetEndBalance: number
): CashBacksolveResult {
  const { netCashflow, usesSignedAmounts } = computeNetCashflow(transactions);

  const computedStartingBalance = roundToCents(targetEndBalance - netCashflow);
  const endingCashBalance = roundToCents(computedStartingBalance + netCashflow);

  return {
    targetEndCashBalance: roundToCents(targetEndBalance),
    netCashflow,
    computedStartingBalance,
    endingCashBalance,
    lastTransactionDate: getLastTransactionDate(transactions),
    usesSignedAmounts,
  };
}
