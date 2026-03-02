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

export interface RecommendedAction {
  type: "proceed" | "delay" | "reduce_amount" | "save_plan" | "adjust_recurring";
  title: string;
  detail: string;
}

export interface DecisionSimulationV2 {
  verdict: "safe" | "tight" | "risky";
  reasons: string[];

  ruleCode: string;
  ruleText: string;

  freeCashBefore: number;
  freeCashAfter: number;
  daysUntilPay: number;
  bufferMonthsBefore: number;
  bufferMonthsAfter: number;

  projectedDate?: string;
  daysUntilPurchase?: number;
  projectedFreeCashAtPurchase?: number;
  bestSafeDate?: string;

  monthsToGoal?: number;
  monthlySavingsNeeded?: number;
  monthlySaveCapacity?: number;
  gapToSafeBudget?: number;

  safePriceToday?: number;
  safePriceAtPurchase?: number;
  maxSafeOneTimeSpend?: number;

  recurringImpactMonthly?: number;
  newPotentialSurplus?: number;
  maxSafeRecurringMonthly?: number;

  targetBufferMonths: number;
  recommendedAction: RecommendedAction;

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
    baseAccum += weeklyContribution;
    const baseValue = baseAccum * (1 + WEEKLY_RATE * (w + 1));
    baseline.push(Math.round(baseValue * 100) / 100);

    const reduction = hitWeeks.has(w) ? Math.min(amount, weeklyContribution) : 0;
    spendAccum += Math.max(weeklyContribution - reduction, 0);
    const spendValue = spendAccum * (1 + WEEKLY_RATE * (w + 1));
    withSpend.push(Math.round(spendValue * 100) / 100);
  }

  const deltaAt90Days = baseline[PROJECTION_WEEKS - 1] - withSpend[PROJECTION_WEEKS - 1];

  let assumption: string;
  if (cadence === "weekly") {
    assumption = `Assumes ${moneyLabel(amount)}/week`;
  } else if (cadence === "monthly") {
    assumption = `Assumes ${moneyLabel(amount)}/month`;
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
const PAY_CYCLE_DAYS = 14;
const SAFE_DATE_SEARCH_WINDOW_DAYS = 120;
const MONTHLY_MARGIN_RATIO = 0.1;

export const TARGET_BUFFER_MONTHS = 2;

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

  const maxSafeOneTimeSpend = computeSafeOneTimeSpendCap(
    totalLiquid,
    snapshot.monthlyEssentials,
    freeCashBefore
  );

  const reasons = assessed.reasons.length > 0 ? assessed.reasons : ["BUFFER_RULE_HELD"];
  const ruleCode = selectPrimaryRuleCode(intent.intentType, reasons);

  return {
    verdict: assessed.verdict,
    reasons,
    ruleCode,
    ruleText: toRuleText(ruleCode),
    freeCashBefore,
    freeCashAfter,
    daysUntilPay,
    bufferMonthsBefore,
    bufferMonthsAfter,
    maxSafeOneTimeSpend,
    safePriceToday: maxSafeOneTimeSpend,
    targetBufferMonths: TARGET_BUFFER_MONTHS,
    recommendedAction: buildImpulseAction(
      assessed.verdict,
      amount,
      maxSafeOneTimeSpend,
      daysUntilPay
    ),
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
  const daysUntilPurchase = diffDaysISO(todayISO, projectedDate);

  const projectedChequingAtD = projectChequingAtDays(snapshot, daysUntilPurchase);
  const freeCashBefore = projectedChequingAtD;
  const freeCashAfter = clampMoney(projectedChequingAtD - amount);

  const totalLiquid = getTotalLiquid(snapshot);
  const bufferMonthsBefore = computeBufferMonths(totalLiquid, snapshot.monthlyEssentials);
  const bufferMonthsAfter = computeBufferMonths(totalLiquid - amount, snapshot.monthlyEssentials);

  const assessed = assessImmediateVerdict(freeCashAfter, bufferMonthsAfter);
  const safePriceAtPurchase = computeSafeOneTimeSpendCap(
    totalLiquid,
    snapshot.monthlyEssentials,
    projectedChequingAtD
  );
  const safePriceToday = computeSafeOneTimeSpendCap(
    totalLiquid,
    snapshot.monthlyEssentials,
    projectChequingAtDays(snapshot, 0)
  );

  let reasons = uniqueReasons([
    "FUTURE_DATE_EVAL",
    ...assessed.reasons,
    ...(projectedChequingAtD < amount ? ["PROJECTED_CHEQUING_LOW"] : []),
  ]);

  if (reasons.length === 1 && reasons[0] === "FUTURE_DATE_EVAL") {
    reasons = ["BUFFER_RULE_HELD", "FUTURE_DATE_EVAL"];
  }

  const bestSafeDate =
    assessed.verdict === "safe"
      ? undefined
      : findBestSafeDateForPurchase(
          snapshot,
          amount,
          totalLiquid,
          snapshot.monthlyEssentials,
          todayISO,
          daysUntilPurchase
        );

  const ruleCode = selectPrimaryRuleCode(intent.intentType, reasons);

  return {
    verdict: assessed.verdict,
    reasons,
    ruleCode,
    ruleText: toRuleText(ruleCode),
    freeCashBefore,
    freeCashAfter,
    daysUntilPay: getDaysUntilPay(snapshot),
    bufferMonthsBefore,
    bufferMonthsAfter,
    projectedDate,
    daysUntilPurchase,
    projectedFreeCashAtPurchase: projectedChequingAtD,
    bestSafeDate,
    safePriceToday,
    safePriceAtPurchase,
    maxSafeOneTimeSpend: safePriceAtPurchase,
    targetBufferMonths: TARGET_BUFFER_MONTHS,
    recommendedAction: buildPlannedAction({
      verdict: assessed.verdict,
      amount,
      projectedDate,
      bestSafeDate,
      safePriceAtPurchase,
    }),
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
  const freeCashBefore = getBaseFreeCashUntilPay(snapshot);
  const freeCashAfter = clampMoney(freeCashBefore - amount);

  const totalLiquid = getTotalLiquid(snapshot);
  const bufferMonthsBefore = computeBufferMonths(totalLiquid, snapshot.monthlyEssentials);
  const bufferMonthsAfter = computeBufferMonths(totalLiquid - amount, snapshot.monthlyEssentials);

  const maxSafeOneTimeSpend = computeSafeOneTimeSpendCap(
    totalLiquid,
    snapshot.monthlyEssentials,
    freeCashBefore
  );

  const gapToSafeBudget = clampMoney(Math.max(amount - maxSafeOneTimeSpend, 0));
  const monthlySaveCapacity = estimateMonthlySaveCapacity(snapshot);

  let monthsToGoal: number | undefined;
  let monthlySavingsNeeded: number | undefined;
  let reasons: string[];
  let verdict: "safe" | "tight" | "risky";

  if (amount <= maxSafeOneTimeSpend) {
    verdict = "safe";
    reasons = ["BUFFER_RULE_HELD"];
  } else {
    verdict = "risky";
    reasons = ["GOAL_REQUIRES_PLANNING", "GAP_TO_SAFE_BUDGET"];

    if (monthlySaveCapacity <= 0) {
      reasons.push("NO_SAVINGS_CAPACITY");
    } else {
      monthsToGoal = Math.ceil(gapToSafeBudget / monthlySaveCapacity);
      monthlySavingsNeeded = clampMoney(gapToSafeBudget / monthsToGoal);
    }
  }

  reasons = uniqueReasons(reasons);
  const ruleCode = selectPrimaryRuleCode(intent.intentType, reasons);

  return {
    verdict,
    reasons,
    ruleCode,
    ruleText: toRuleText(ruleCode),
    freeCashBefore,
    freeCashAfter,
    daysUntilPay: getDaysUntilPay(snapshot),
    bufferMonthsBefore,
    bufferMonthsAfter,
    maxSafeOneTimeSpend,
    safePriceToday: maxSafeOneTimeSpend,
    gapToSafeBudget,
    monthsToGoal,
    monthlySavingsNeeded,
    monthlySaveCapacity,
    targetBufferMonths: TARGET_BUFFER_MONTHS,
    recommendedAction: buildBigGoalAction({
      verdict,
      maxSafeOneTimeSpend,
      gapToSafeBudget,
      monthlySavingsNeeded,
      monthsToGoal,
      monthlySaveCapacity,
    }),
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
  const maxSafeRecurringMonthly = computeMaxSafeRecurringMonthly(snapshot, freeCashBefore);

  const reasons = ["RECURRING_RAISES_BURN"];

  if (freeCashAfter < 0) {
    reasons.push("FREE_CASH_NEGATIVE");
  }

  if (newPotentialSurplus < 0) {
    reasons.push("SURPLUS_NEGATIVE");
  }

  if (bufferMonthsAfter < 1) {
    reasons.push("BUFFER_LT_1");
  } else if (bufferMonthsAfter < TARGET_BUFFER_MONTHS) {
    reasons.push("BUFFER_LT_2");
  }

  let verdict: "safe" | "tight" | "risky";

  if (freeCashAfter < 0 || newPotentialSurplus < 0) {
    verdict = "risky";
  } else if (
    newPotentialSurplus < snapshot.monthlyIncome * MONTHLY_MARGIN_RATIO ||
    bufferMonthsAfter < TARGET_BUFFER_MONTHS
  ) {
    verdict = "tight";
  } else {
    verdict = "safe";
  }

  const finalReasons = uniqueReasons(
    reasons.length > 0 ? reasons : ["BUFFER_RULE_HELD"]
  );

  const ruleCode = selectPrimaryRuleCode(intent.intentType, finalReasons);

  return {
    verdict,
    reasons: finalReasons,
    ruleCode,
    ruleText: toRuleText(ruleCode),
    freeCashBefore,
    freeCashAfter,
    daysUntilPay,
    bufferMonthsBefore,
    bufferMonthsAfter,
    recurringImpactMonthly: monthlyEquivalent,
    newPotentialSurplus,
    maxSafeRecurringMonthly,
    targetBufferMonths: TARGET_BUFFER_MONTHS,
    recommendedAction: buildRecurringAction(
      verdict,
      monthlyEquivalent,
      maxSafeRecurringMonthly
    ),
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
  } else if (bufferMonthsAfter < TARGET_BUFFER_MONTHS) {
    reasons.push("BUFFER_LT_2");
  }

  let verdict: "safe" | "tight" | "risky";

  if (freeCashAfter < 0 || bufferMonthsAfter < 1) {
    verdict = "risky";
  } else if (bufferMonthsAfter < TARGET_BUFFER_MONTHS) {
    verdict = "tight";
  } else {
    verdict = "safe";
  }

  return {
    verdict,
    reasons: uniqueReasons(reasons),
  };
}

function buildImpulseAction(
  verdict: "safe" | "tight" | "risky",
  amount: number,
  maxSafeNow: number,
  daysUntilPay: number
): RecommendedAction {
  if (verdict === "safe") {
    return {
      type: "proceed",
      title: "Recommended: Proceed now",
      detail: `${moneyLabel(amount)} stays within your ${TARGET_BUFFER_MONTHS}-month safety rule.`,
    };
  }

  if (maxSafeNow <= 0) {
    return {
      type: "delay",
      title: "Recommended: Wait until next payday",
      detail: `You have ${daysUntilPay} days until payday and no safe one-time room right now.`,
    };
  }

  return {
    type: "reduce_amount",
    title: `Recommended: Keep it at or below ${moneyLabel(maxSafeNow)}`,
    detail:
      verdict === "risky"
        ? "This keeps chequing above $0 and protects your buffer rule."
        : `At ${moneyLabel(amount)}, buffer drops below ${TARGET_BUFFER_MONTHS} months.`,
  };
}

function buildPlannedAction(input: {
  verdict: "safe" | "tight" | "risky";
  amount: number;
  projectedDate: string;
  bestSafeDate?: string;
  safePriceAtPurchase: number;
}): RecommendedAction {
  if (input.verdict === "safe") {
    return {
      type: "proceed",
      title: `Recommended: Buy on ${input.projectedDate}`,
      detail: `${moneyLabel(input.amount)} fits the projected date while holding the buffer rule.`,
    };
  }

  if (input.bestSafeDate) {
    return {
      type: "delay",
      title: `Recommended: Delay to ${input.bestSafeDate}`,
      detail: `That is the first modeled date this purchase clears chequing and the ${TARGET_BUFFER_MONTHS}-month buffer rule.`,
    };
  }

  return {
    type: "reduce_amount",
    title: `Recommended: Reduce to ${moneyLabel(input.safePriceAtPurchase)}`,
    detail: `At ${moneyLabel(input.amount)}, this breaks your ${TARGET_BUFFER_MONTHS}-month safety rule on the purchase date.`,
  };
}

function buildBigGoalAction(input: {
  verdict: "safe" | "tight" | "risky";
  maxSafeOneTimeSpend: number;
  gapToSafeBudget: number;
  monthlySavingsNeeded?: number;
  monthsToGoal?: number;
  monthlySaveCapacity: number;
}): RecommendedAction {
  if (input.verdict === "safe") {
    return {
      type: "proceed",
      title: "Recommended: Proceed at this budget",
      detail: `This sits inside your safe one-time cap of ${moneyLabel(input.maxSafeOneTimeSpend)}.`,
    };
  }

  if (input.monthlySavingsNeeded && input.monthsToGoal) {
    return {
      type: "save_plan",
      title: `Recommended: Save ${moneyLabel(input.monthlySavingsNeeded)}/month for ${input.monthsToGoal} months`,
      detail: `That closes the ${moneyLabel(input.gapToSafeBudget)} gap to your safe budget.`,
    };
  }

  if (input.monthlySaveCapacity <= 0) {
    return {
      type: "save_plan",
      title: "Recommended: Create monthly savings capacity first",
      detail: `Current model shows ${moneyLabel(0)}/month capacity toward this goal.`,
    };
  }

  return {
    type: "reduce_amount",
    title: `Recommended: Keep initial spend under ${moneyLabel(input.maxSafeOneTimeSpend)}`,
    detail: `Current ask is ${moneyLabel(input.gapToSafeBudget)} above the safe budget.`,
  };
}

function buildRecurringAction(
  verdict: "safe" | "tight" | "risky",
  monthlyEquivalent: number,
  maxSafeRecurringMonthly: number
): RecommendedAction {
  if (verdict === "safe") {
    return {
      type: "proceed",
      title: "Recommended: Keep this recurring spend",
      detail: `${moneyLabel(monthlyEquivalent)}/month stays within your recurring safety band.`,
    };
  }

  if (maxSafeRecurringMonthly <= 0) {
    return {
      type: "adjust_recurring",
      title: "Recommended: Do not add this recurring cost yet",
      detail: "Current model leaves no safe recurring room without breaking surplus rules.",
    };
  }

  return {
    type: "adjust_recurring",
    title: `Recommended: Cap recurring spend at ${moneyLabel(maxSafeRecurringMonthly)}/month`,
    detail: `${moneyLabel(monthlyEquivalent)}/month is above your modeled recurring limit.`,
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

function selectPrimaryRuleCode(intentType: IntentType, reasons: string[]): string {
  const priorityByIntent: Record<IntentType, string[]> = {
    impulse: ["FREE_CASH_NEGATIVE", "BUFFER_LT_1", "BUFFER_LT_2", "BUFFER_RULE_HELD"],
    planned_purchase: ["PROJECTED_CHEQUING_LOW", "BUFFER_LT_1", "BUFFER_LT_2", "BUFFER_RULE_HELD", "FUTURE_DATE_EVAL"],
    big_goal: ["GAP_TO_SAFE_BUDGET", "NO_SAVINGS_CAPACITY", "GOAL_REQUIRES_PLANNING", "BUFFER_RULE_HELD"],
    recurring: ["SURPLUS_NEGATIVE", "FREE_CASH_NEGATIVE", "RECURRING_RAISES_BURN", "BUFFER_LT_2", "BUFFER_RULE_HELD"],
  };

  const priority = priorityByIntent[intentType];
  for (const code of priority) {
    if (reasons.includes(code)) {
      return code;
    }
  }

  return reasons[0] ?? "BUFFER_RULE_HELD";
}

function toRuleText(ruleCode: string): string {
  switch (ruleCode) {
    case "FREE_CASH_NEGATIVE":
      return "Chequing dips below $0 before payday.";
    case "BUFFER_LT_1":
      return "Buffer falls below 1 month of essentials.";
    case "BUFFER_LT_2":
      return `Buffer falls below ${TARGET_BUFFER_MONTHS} months of essentials.`;
    case "PROJECTED_CHEQUING_LOW":
      return "Projected chequing is too low at the purchase date.";
    case "GAP_TO_SAFE_BUDGET":
      return `Amount exceeds your ${TARGET_BUFFER_MONTHS}-month safety buffer rule.`;
    case "NO_SAVINGS_CAPACITY":
      return "Current monthly savings capacity is $0.";
    case "GOAL_REQUIRES_PLANNING":
      return "Goal needs a savings runway first.";
    case "SURPLUS_NEGATIVE":
      return "Potential surplus turns negative.";
    case "RECURRING_RAISES_BURN":
      return "Recurring cost raises monthly burn.";
    case "FUTURE_DATE_EVAL":
      return "Decision evaluated at the purchase date.";
    case "BUFFER_RULE_HELD":
      return `Stays within your ${TARGET_BUFFER_MONTHS}-month buffer rule.`;
    default:
      return "Scenario stays within current guardrails.";
  }
}

function findBestSafeDateForPurchase(
  snapshot: CashflowSnapshot,
  amount: number,
  totalLiquid: number,
  monthlyEssentials: number,
  todayISO: string,
  startDays: number
): string | undefined {
  const bufferCap = totalLiquid - TARGET_BUFFER_MONTHS * monthlyEssentials;
  if (bufferCap < amount) {
    return undefined;
  }

  for (let offset = 0; offset <= SAFE_DATE_SEARCH_WINDOW_DAYS; offset++) {
    const days = startDays + offset;
    const projectedCash = projectChequingAtDays(snapshot, days);
    if (projectedCash - amount >= 0) {
      return addDaysISO(todayISO, days);
    }
  }

  return undefined;
}

function projectChequingAtDays(snapshot: CashflowSnapshot, daysFromToday: number): number {
  const days = Math.max(0, Math.trunc(daysFromToday));
  const paychecks = countPaychecksByDay(days, getDaysUntilPay(snapshot));
  const incomeInflow = paychecks * estimateBiweeklyIncome(snapshot.monthlyIncome);
  const burn = snapshot.dailyBurnRate * days;

  return clampMoney(snapshot.chequingBalance - burn + incomeInflow);
}

function countPaychecksByDay(daysFromToday: number, daysUntilNextPay: number): number {
  if (daysFromToday < daysUntilNextPay) {
    return 0;
  }

  return 1 + Math.floor((daysFromToday - daysUntilNextPay) / PAY_CYCLE_DAYS);
}

function estimateBiweeklyIncome(monthlyIncome: number): number {
  return clampMoney((monthlyIncome * 12) / 26);
}

function computeSafeOneTimeSpendCap(
  totalLiquid: number,
  monthlyEssentials: number,
  freeCash: number
): number {
  const byBuffer = Math.max(totalLiquid - TARGET_BUFFER_MONTHS * monthlyEssentials, 0);
  const byFreeCash = Math.max(freeCash, 0);
  return clampMoney(Math.min(byBuffer, byFreeCash));
}

function computeMaxSafeRecurringMonthly(
  snapshot: CashflowSnapshot,
  freeCashBefore: number
): number {
  const bySurplus = Math.max(
    snapshot.potentialSurplus - snapshot.monthlyIncome * MONTHLY_MARGIN_RATIO,
    0
  );

  const daysUntilPay = getDaysUntilPay(snapshot);
  const byFreeCash =
    daysUntilPay > 0 ? Math.max((freeCashBefore * 30) / daysUntilPay, 0) : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(byFreeCash)) {
    return clampMoney(bySurplus);
  }

  return clampMoney(Math.min(bySurplus, byFreeCash));
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

function moneyLabel(amount: number): string {
  const normalized = clampMoney(amount);
  const hasCents = Math.abs(normalized % 1) > 0;

  return `$${normalized.toLocaleString("en-CA", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

