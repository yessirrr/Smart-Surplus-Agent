import type {
  PaySchedule,
  SurplusSummary,
  Transaction,
  UserProfile,
} from "@/lib/types";

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
  snapshotDateISO: string;
  latestTransactionDateISO?: string;
  nextPayDateISO: string;
}

export function buildCashflowSnapshot(
  surplusSummary: SurplusSummary,
  profile: UserProfile,
  transactions: Transaction[],
  paySchedule: PaySchedule = {
    frequency: "biweekly",
    dayOfWeek: "friday",
    amount: profile.income.net_biweekly,
  }
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

  // Latest transaction date remains the default "today" proxy.
  const latestTransactionDateISO = transactions.reduce((latest, transaction) => {
    return transaction.date > latest ? transaction.date : latest;
  }, transactions[0]?.date ?? "2025-01-01");

  const snapshotDateISO = latestTransactionDateISO;
  const nextPay = computeDaysUntilNextPay(
    new Date(snapshotDateISO + "T00:00:00"),
    paySchedule
  );

  const daysUntilNextPay = nextPay.daysUntilNextPay;
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
    snapshotDateISO,
    latestTransactionDateISO,
    nextPayDateISO: nextPay.nextPayDateISO,
  };
}

/**
 * Compute days until next pay date from a normalized "as-of" date.
 *
 * Current support is intentionally narrow to preserve existing behavior:
 * biweekly Friday using an anchor of 2024-01-05.
 * TODO: expand to profile-derived anchors and additional schedules.
 */
export function computeDaysUntilNextPay(
  asOfDate: Date,
  paySchedule: PaySchedule
): { daysUntilNextPay: number; nextPayDateISO: string } {
  if (paySchedule.frequency !== "biweekly") {
    throw new Error(
      "Unsupported pay schedule frequency for Decision Mode: only biweekly is currently supported."
    );
  }

  const normalizedPayDay = (paySchedule.dayOfWeek ?? "friday").toLowerCase();
  if (normalizedPayDay !== "friday") {
    throw new Error(
      "Unsupported biweekly pay day for Decision Mode: only friday is currently supported."
    );
  }

  const from = new Date(
    Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate())
  );

  const anchor = new Date(Date.UTC(2024, 0, 5));

  const diffMs = from.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const cyclesPassed = Math.floor(diffDays / 14);
  const nextPayMs = anchor.getTime() + (cyclesPassed + 1) * 14 * 24 * 60 * 60 * 1000;
  const nextPay = new Date(nextPayMs);

  const rawDaysUntil = Math.ceil(
    (nextPay.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysUntilNextPay = rawDaysUntil <= 0 ? 14 : rawDaysUntil;
  const nextPayDateISO =
    rawDaysUntil <= 0
      ? new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : nextPay.toISOString().slice(0, 10);

  return {
    daysUntilNextPay,
    nextPayDateISO,
  };
}
