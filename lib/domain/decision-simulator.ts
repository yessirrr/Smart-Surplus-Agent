import type { CashflowSnapshot } from "./cashflow-model";
import {
  assertValidIntent,
  type DecisionIntent,
  type IntentType,
  type SpendCadence,
  type TimeHorizon,
} from "./decision-intent";

export interface DivergenceProjection {
  weeks: number;
  baseline: number[];
  withSpend: number[];
  deltaAt90Days: number;
  assumption: string;
}

export interface DecisionSimulation {
  proposedAmount: number;

  // Direct impact
  newFreeCash: number;
  freeCashDelta: number;

  // Surplus impact
  newMonthlySurplus: number;
  surplusStillPositive: boolean;

  // Buffer impact
  bufferAfter: number;
  bufferMonths: number;
  bufferHealthy: boolean;

  // Investment impact
  weeklyInvestmentAmount: number;
  investmentAtRisk: boolean;

  // Streak impact
  streakAtRisk: boolean;

  // Verdict
  verdict: "safe" | "tight" | "risky";
  verdictReasons: string[];
}

export interface DecisionSimulationV2 {
  verdict: "safe" | "tight" | "risky";
  reasons: string[];

  freeCashBefore: number;
  freeCashAfter: number;
  daysUntilPay: number;
  bufferMonthsBefore: number;
  bufferMonthsAfter: number;

  projectedDate?: string;
  monthsToGoal?: number;
  monthlySavingsNeeded?: number;
  maxSafeOneTimeSpend?: number;
  recurringImpactMonthly?: number;

  meta: {
    intentType: IntentType;
    cadence: SpendCadence;
    horizon: TimeHorizon;
  };
}

export function simulateDecision(
  amount: number,
  snapshot: CashflowSnapshot
): DecisionSimulation {
  const newFreeCash = snapshot.freeCashUntilPay - amount;
  const freeCashDelta = -amount;

  const newMonthlySurplus = snapshot.currentSurplus - amount;
  const surplusStillPositive = newMonthlySurplus > 0;

  const bufferAfter = snapshot.totalLiquid - amount;
  const bufferMonths =
    snapshot.monthlyEssentials > 0
      ? bufferAfter / snapshot.monthlyEssentials
      : 0;
  const bufferHealthy = bufferMonths >= 1;

  const weeklyInvestmentAmount = snapshot.potentialSurplus / 4;
  const investmentAtRisk = amount > snapshot.freeCashUntilPay;

  const streakAtRisk = !surplusStillPositive;

  // Build reason codes
  const verdictReasons: string[] = [];

  if (!surplusStillPositive) {
    verdictReasons.push("surplus_negative");
  }

  if (bufferMonths < 0.5) {
    verdictReasons.push("buffer_critical");
  } else if (bufferMonths < 1) {
    verdictReasons.push("buffer_low");
  }

  if (newFreeCash < 0) {
    verdictReasons.push("free_cash_negative");
  }

  if (investmentAtRisk) {
    verdictReasons.push("investment_disrupted");
  }

  if (streakAtRisk) {
    verdictReasons.push("streak_broken");
  }

  if (verdictReasons.length === 0) {
    verdictReasons.push("fully_covered");
  }

  // Determine verdict
  let verdict: "safe" | "tight" | "risky";

  const isRisky =
    newFreeCash < 0 ||
    bufferMonths < 0.5 ||
    (!surplusStillPositive && bufferAfter < snapshot.monthlyEssentials);

  const isSafe =
    newFreeCash > 0 &&
    surplusStillPositive &&
    bufferMonths >= 1 &&
    !investmentAtRisk;

  if (isRisky) {
    verdict = "risky";
  } else if (isSafe) {
    verdict = "safe";
  } else {
    verdict = "tight";
  }

  return {
    proposedAmount: amount,
    newFreeCash,
    freeCashDelta,
    newMonthlySurplus,
    surplusStillPositive,
    bufferAfter,
    bufferMonths,
    bufferHealthy,
    weeklyInvestmentAmount,
    investmentAtRisk,
    streakAtRisk,
    verdict,
    verdictReasons,
  };
}

const PROJECTION_WEEKS = 12;
const ANNUAL_RATE = 0.07;
const WEEKLY_RATE = ANNUAL_RATE / 52;

export function projectDivergence(
  amount: number,
  cadence: SpendCadence,
  snapshot: CashflowSnapshot
): DivergenceProjection {
  const weeklyContribution = Math.max(snapshot.potentialSurplus / 4, 0);

  // Build hit schedule based on cadence
  const hitWeeks = new Set<number>();
  if (cadence === "one_time") {
    hitWeeks.add(0);
  } else if (cadence === "weekly") {
    for (let w = 0; w < PROJECTION_WEEKS; w++) hitWeeks.add(w);
  } else if (cadence === "monthly") {
    hitWeeks.add(0);
    hitWeeks.add(4);
    hitWeeks.add(8);
  }

  const baseline: number[] = [];
  const withSpend: number[] = [];

  let baseAccum = 0;
  let spendAccum = 0;

  for (let w = 0; w < PROJECTION_WEEKS; w++) {
    // Baseline: full contribution every week
    baseAccum += weeklyContribution;
    const baseValue = baseAccum * (1 + WEEKLY_RATE * (w + 1));
    baseline.push(Math.round(baseValue * 100) / 100);

    // With spend: contribution reduced on hit weeks
    const reduction = hitWeeks.has(w) ? Math.min(amount, weeklyContribution) : 0;
    spendAccum += Math.max(weeklyContribution - reduction, 0);
    const spendValue = spendAccum * (1 + WEEKLY_RATE * (w + 1));
    withSpend.push(Math.round(spendValue * 100) / 100);
  }

  const deltaAt90Days = baseline[PROJECTION_WEEKS - 1] - withSpend[PROJECTION_WEEKS - 1];

  let assumption: string;
  if (cadence === "weekly") {
    assumption = `Assumes $${Math.round(amount)}/week`;
  } else if (cadence === "monthly") {
    assumption = `Assumes $${Math.round(amount)}/month`;
  } else {
    assumption = "Assumes one-time";
  }

  return {
    weeks: PROJECTION_WEEKS,
    baseline,
    withSpend,
    deltaAt90Days: Math.round(deltaAt90Days * 100) / 100,
    assumption,
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKLY_TO_MONTHLY = 4.33;
const BIG_GOAL_TARGET_BUFFER_MONTHS = 2;

export function clampMoney(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }

  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function computeBufferMonths(
  totalLiquidAfter: number,
  monthlyEssentials: number
): number {
  if (!Number.isFinite(monthlyEssentials) || monthlyEssentials <= 0) {
    return 0;
  }

  return clampMoney(totalLiquidAfter / monthlyEssentials);
}

export function addDaysISO(dateISO: string, days: number): string {
  const parsed = parseISODate(dateISO);
  const normalizedDays = Number.isFinite(days) ? Math.trunc(days) : 0;
  const shifted = new Date(parsed.getTime() + normalizedDays * MS_PER_DAY);
  return formatISODate(shifted);
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  const diff = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
  return diff < 0 ? 0 : diff;
}

export function simulateDecisionByIntent(
  intent: DecisionIntent,
  snapshot: CashflowSnapshot
): DecisionSimulationV2 {
  assertValidIntent(intent);

  if (intent.intentType === "impulse") {
    return simulateImpulseIntent(intent, snapshot);
  }

  if (intent.intentType === "planned_purchase") {
    return simulatePlannedPurchaseIntent(intent, snapshot);
  }

  if (intent.intentType === "big_goal") {
    return simulateBigGoalIntent(intent, snapshot);
  }

  return simulateRecurringIntent(intent, snapshot);
}

function simulateImpulseIntent(
  intent: DecisionIntent,
  snapshot: CashflowSnapshot
): DecisionSimulationV2 {
  const amount = clampMoney(intent.amount);
  const daysUntilPay = getDaysUntilPay(snapshot);
  const freeCashBefore = getBaseFreeCashUntilPay(snapshot);
  const freeCashAfter = clampMoney(freeCashBefore - amount);

  const totalLiquid = getTotalLiquid(snapshot);
  const bufferMonthsBefore = computeBufferMonths(totalLiquid, snapshot.monthlyEssentials);
  const bufferMonthsAfter = computeBufferMonths(totalLiquid - amount, snapshot.monthlyEssentials);

  const assessed = assessImmediateVerdict(freeCashAfter, bufferMonthsAfter);

  return {
    verdict: assessed.verdict,
    reasons: assessed.reasons,
    freeCashBefore,
    freeCashAfter,
    daysUntilPay,
    bufferMonthsBefore,
    bufferMonthsAfter,
    meta: {
      intentType: intent.intentType,
      cadence: intent.cadence,
      horizon: intent.horizon,
    },
  };
}

function simulatePlannedPurchaseIntent(
  intent: DecisionIntent,
  snapshot: CashflowSnapshot
): DecisionSimulationV2 {
  const amount = clampMoney(intent.amount);
  const todayISO = getTodayISO(snapshot);
  const projectedDate = resolveEvaluationDate(intent.horizon, todayISO);

  const daysUntilD = diffDaysISO(todayISO, projectedDate);
  const projectedSpendUntilD = clampMoney(snapshot.dailyBurnRate * daysUntilD);
  const projectedFreeCashAtD = clampMoney(snapshot.chequingBalance - projectedSpendUntilD);

  const freeCashBefore = projectedFreeCashAtD;
  const freeCashAfter = clampMoney(projectedFreeCashAtD - amount);

  const totalLiquid = getTotalLiquid(snapshot);
  const bufferMonthsBefore = computeBufferMonths(totalLiquid, snapshot.monthlyEssentials);
  const bufferMonthsAfter = computeBufferMonths(totalLiquid - amount, snapshot.monthlyEssentials);
  const daysUntilPay = getDaysUntilPay(snapshot);

  const assessed = assessImmediateVerdict(freeCashAfter, bufferMonthsAfter);
  const reasons = uniqueReasons([
    "FUTURE_DATE_EVAL",
    ...assessed.reasons,
    ...(projectedFreeCashAtD < amount ? ["PROJECTED_CHEQUING_LOW"] : []),
  ]);

  return {
    verdict: assessed.verdict,
    reasons,
    freeCashBefore,
    freeCashAfter,
    daysUntilPay,
    bufferMonthsBefore,
    bufferMonthsAfter,
    projectedDate,
    meta: {
      intentType: intent.intentType,
      cadence: intent.cadence,
      horizon: intent.horizon,
    },
  };
}

function simulateBigGoalIntent(
  intent: DecisionIntent,
  snapshot: CashflowSnapshot
): DecisionSimulationV2 {
  const amount = clampMoney(intent.amount);
  const daysUntilPay = getDaysUntilPay(snapshot);
  const freeCashBefore = getBaseFreeCashUntilPay(snapshot);
  const freeCashAfter = clampMoney(freeCashBefore - amount);

  const totalLiquid = getTotalLiquid(snapshot);
  const bufferMonthsBefore = computeBufferMonths(totalLiquid, snapshot.monthlyEssentials);
  const bufferMonthsAfter = computeBufferMonths(totalLiquid - amount, snapshot.monthlyEssentials);

  const maxSafeOneTimeSpend = clampMoney(
    Math.max(totalLiquid - BIG_GOAL_TARGET_BUFFER_MONTHS * snapshot.monthlyEssentials, 0)
  );

  const assessed = assessImmediateVerdict(freeCashAfter, bufferMonthsAfter);

  if (amount <= maxSafeOneTimeSpend) {
    return {
      verdict: assessed.verdict,
      reasons: assessed.reasons,
      freeCashBefore,
      freeCashAfter,
      daysUntilPay,
      bufferMonthsBefore,
      bufferMonthsAfter,
      maxSafeOneTimeSpend,
      meta: {
        intentType: intent.intentType,
        cadence: intent.cadence,
        horizon: intent.horizon,
      },
    };
  }

  const gap = clampMoney(amount - maxSafeOneTimeSpend);
  const monthlySaveCapacity = estimateMonthlySaveCapacity(snapshot);

  let monthsToGoal: number | undefined;
  let monthlySavingsNeeded: number | undefined;

  const reasons = [
    "GOAL_REQUIRES_PLANNING",
    "GAP_TO_SAFE_BUDGET",
    ...assessed.reasons,
  ];

  if (monthlySaveCapacity <= 0) {
    reasons.push("NO_SAVINGS_CAPACITY");
  } else {
    monthsToGoal = Math.ceil(gap / monthlySaveCapacity);
    monthlySavingsNeeded = clampMoney(gap / monthsToGoal);
  }

  return {
    verdict: "risky",
    reasons: uniqueReasons(reasons),
    freeCashBefore,
    freeCashAfter,
    daysUntilPay,
    bufferMonthsBefore,
    bufferMonthsAfter,
    maxSafeOneTimeSpend,
    monthsToGoal,
    monthlySavingsNeeded,
    meta: {
      intentType: intent.intentType,
      cadence: intent.cadence,
      horizon: intent.horizon,
    },
  };
}

function simulateRecurringIntent(
  intent: DecisionIntent,
  snapshot: CashflowSnapshot
): DecisionSimulationV2 {
  const amount = clampMoney(intent.amount);
  const monthlyEquivalent =
    intent.cadence === "weekly"
      ? clampMoney(amount * WEEKLY_TO_MONTHLY)
      : amount;

  const daysUntilPay = getDaysUntilPay(snapshot);
  const freeCashBefore = getBaseFreeCashUntilPay(snapshot);

  const newMonthlyDiscretionary = snapshot.monthlyDiscretionary + monthlyEquivalent;
  const newDailyBurnRate = (snapshot.monthlyEssentials + newMonthlyDiscretionary) / 30;
  const freeCashAfter = clampMoney(
    snapshot.chequingBalance - newDailyBurnRate * daysUntilPay
  );

  const totalLiquid = getTotalLiquid(snapshot);
  const bufferMonthsBefore = computeBufferMonths(totalLiquid, snapshot.monthlyEssentials);
  const bufferMonthsAfter = computeBufferMonths(totalLiquid, snapshot.monthlyEssentials);

  const newPotentialSurplus = clampMoney(snapshot.potentialSurplus - monthlyEquivalent);

  const reasons = ["RECURRING_RAISES_BURN"];

  if (freeCashAfter < 0) {
    reasons.push("FREE_CASH_NEGATIVE");
  }

  if (newPotentialSurplus < 0) {
    reasons.push("SURPLUS_NEGATIVE");
  }

  if (bufferMonthsAfter < 1) {
    reasons.push("BUFFER_LT_1");
  } else if (bufferMonthsAfter < 2) {
    reasons.push("BUFFER_LT_2");
  }

  let verdict: "safe" | "tight" | "risky";

  if (freeCashAfter < 0 || newPotentialSurplus < 0) {
    verdict = "risky";
  } else if (
    newPotentialSurplus < snapshot.monthlyIncome * 0.1 ||
    bufferMonthsAfter < 2
  ) {
    verdict = "tight";
  } else {
    verdict = "safe";
  }

  return {
    verdict,
    reasons: uniqueReasons(reasons),
    freeCashBefore,
    freeCashAfter,
    daysUntilPay,
    bufferMonthsBefore,
    bufferMonthsAfter,
    recurringImpactMonthly: monthlyEquivalent,
    meta: {
      intentType: intent.intentType,
      cadence: intent.cadence,
      horizon: intent.horizon,
    },
  };
}

function assessImmediateVerdict(
  freeCashAfter: number,
  bufferMonthsAfter: number
): { verdict: "safe" | "tight" | "risky"; reasons: string[] } {
  const reasons: string[] = [];

  if (freeCashAfter < 0) {
    reasons.push("FREE_CASH_NEGATIVE");
  }

  if (bufferMonthsAfter < 1) {
    reasons.push("BUFFER_LT_1");
  } else if (bufferMonthsAfter < 2) {
    reasons.push("BUFFER_LT_2");
  }

  let verdict: "safe" | "tight" | "risky";

  if (freeCashAfter < 0 || bufferMonthsAfter < 1) {
    verdict = "risky";
  } else if (bufferMonthsAfter < 2) {
    verdict = "tight";
  } else {
    verdict = "safe";
  }

  return {
    verdict,
    reasons: uniqueReasons(reasons),
  };
}

function resolveEvaluationDate(horizon: TimeHorizon, todayISO: string): string {
  if (horizon.kind === "date") {
    return normalizeISODate(horizon.value as string);
  }

  if (horizon.kind === "relative_days") {
    return addDaysISO(todayISO, horizon.value as number);
  }

  if (horizon.kind === "this_month") {
    return addDaysISO(todayISO, 30);
  }

  if (horizon.kind === "this_week") {
    return addDaysISO(todayISO, 7);
  }

  return todayISO;
}

function getTodayISO(snapshot: CashflowSnapshot): string {
  const snapshotWithDate = snapshot as CashflowSnapshot & {
    snapshotDate?: string;
    snapshotDateISO?: string;
    latestTransactionDate?: string;
  };

  const candidate =
    snapshotWithDate.snapshotDate ??
    snapshotWithDate.snapshotDateISO ??
    snapshotWithDate.latestTransactionDate;

  if (typeof candidate === "string" && ISO_DATE_RE.test(candidate)) {
    return normalizeISODate(candidate);
  }

  return formatISODate(new Date());
}

function getSavingsBalance(snapshot: CashflowSnapshot): number {
  const snapshotWithSavings = snapshot as CashflowSnapshot & { savingsBalance?: number };
  if (
    typeof snapshotWithSavings.savingsBalance === "number" &&
    Number.isFinite(snapshotWithSavings.savingsBalance)
  ) {
    return snapshotWithSavings.savingsBalance;
  }

  if (Number.isFinite(snapshot.savingsBuffer)) {
    return snapshot.savingsBuffer;
  }

  return 0;
}

function getTotalLiquid(snapshot: CashflowSnapshot): number {
  return clampMoney(snapshot.chequingBalance + getSavingsBalance(snapshot));
}

function getDaysUntilPay(snapshot: CashflowSnapshot): number {
  if (!Number.isFinite(snapshot.daysUntilNextPay)) {
    return 0;
  }

  const normalized = Math.trunc(snapshot.daysUntilNextPay);
  return normalized < 0 ? 0 : normalized;
}

function getBaseFreeCashUntilPay(snapshot: CashflowSnapshot): number {
  if (Number.isFinite(snapshot.freeCashUntilPay)) {
    return clampMoney(snapshot.freeCashUntilPay);
  }

  const daysUntilPay = getDaysUntilPay(snapshot);
  return clampMoney(snapshot.chequingBalance - snapshot.dailyBurnRate * daysUntilPay);
}

function estimateMonthlySaveCapacity(snapshot: CashflowSnapshot): number {
  if (snapshot.potentialSurplus > 0) {
    return clampMoney(snapshot.potentialSurplus);
  }

  const approximated =
    snapshot.monthlyIncome -
    (snapshot.monthlyEssentials + snapshot.monthlyDiscretionary);

  return clampMoney(Math.max(approximated, 0));
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

function parseISODate(dateISO: string): Date {
  if (!ISO_DATE_RE.test(dateISO)) {
    throw new Error(`Invalid ISO date: ${dateISO}`);
  }

  const [yearText, monthText, dayText] = dateISO.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ISO date: ${dateISO}`);
  }

  return parsed;
}

function formatISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeISODate(dateISO: string): string {
  return formatISODate(parseISODate(dateISO));
}
