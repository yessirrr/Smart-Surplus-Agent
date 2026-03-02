import type { SurplusSummary, UserProfile, Transaction } from "@/lib/types";

export interface CashflowSnapshot {
  monthlyIncome: number;
  monthlyEssentials: number;
  monthlyDiscretionary: number;
  monthlyHabitSpend: number;
  currentSurplus: number;
  potentialSurplus: number;
  chequingBalance: number;
  savingsBuffer: number;
  totalLiquid: number;
  monthlyCommitments: number;
  daysUntilNextPay: number;
  freeCashUntilPay: number;
  dailyBurnRate: number;
}

export function buildCashflowSnapshot(
  surplusSummary: SurplusSummary,
  profile: UserProfile,
  transactions: Transaction[]
): CashflowSnapshot {
  const monthlyIncome = (profile.income.net_biweekly * 26) / 12;

  const monthlyEssentials = surplusSummary.categoryBreakdown
    .filter((c) => c.isEssential)
    .reduce((sum, c) => sum + c.monthlyAverage, 0);

  const monthlyDiscretionary = surplusSummary.categoryBreakdown
    .filter((c) => !c.isEssential && c.category !== "income" && c.category !== "transfer")
    .reduce((sum, c) => sum + c.monthlyAverage, 0);

  const monthlyHabitSpend =
    surplusSummary.averageMonthlyPotentialSurplus -
    surplusSummary.averageMonthlySurplus;

  const currentSurplus = surplusSummary.averageMonthlySurplus;
  const potentialSurplus = surplusSummary.averageMonthlyPotentialSurplus;

  const chequingBalance = profile.accounts.chequing_balance;
  const savingsBuffer = profile.accounts.savings_balance;
  const totalLiquid = chequingBalance + savingsBuffer;

  const monthlyCommitments = surplusSummary.categoryBreakdown
    .filter((c) => c.isEssential)
    .reduce((sum, c) => sum + c.monthlyAverage, 0);

  const dailyBurnRate = (monthlyEssentials + monthlyDiscretionary) / 30;

  // Find latest transaction date as proxy for "today"
  const latestDate = transactions.reduce((latest, t) => {
    return t.date > latest ? t.date : latest;
  }, transactions[0]?.date ?? "2025-01-01");

  const daysUntilNextPay = computeDaysUntilNextPay(latestDate);
  const freeCashUntilPay = chequingBalance - dailyBurnRate * daysUntilNextPay;

  return {
    monthlyIncome,
    monthlyEssentials,
    monthlyDiscretionary,
    monthlyHabitSpend,
    currentSurplus,
    potentialSurplus,
    chequingBalance,
    savingsBuffer,
    totalLiquid,
    monthlyCommitments,
    daysUntilNextPay,
    freeCashUntilPay,
    dailyBurnRate,
  };
}

/**
 * Compute days until next biweekly Friday payday from a given date.
 * Uses a known pay Friday (2024-01-05) as the anchor and counts
 * forward in 14-day increments.
 */
function computeDaysUntilNextPay(fromDateStr: string): number {
  const from = new Date(fromDateStr + "T00:00:00");
  // Known pay Friday anchor
  const anchor = new Date("2024-01-05T00:00:00");

  const diffMs = from.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // How many full 14-day cycles have passed
  const cyclesPassed = Math.floor(diffDays / 14);
  // Next pay date is (cyclesPassed + 1) * 14 days after anchor
  const nextPayMs = anchor.getTime() + (cyclesPassed + 1) * 14 * 24 * 60 * 60 * 1000;
  const nextPay = new Date(nextPayMs);

  const daysUntil = Math.ceil(
    (nextPay.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If today IS payday, next pay is in 14 days
  return daysUntil <= 0 ? 14 : daysUntil;
}
