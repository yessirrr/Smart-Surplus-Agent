import type { CashflowSnapshot } from "./cashflow-model";
import type { SpendCadence } from "@/lib/agent/skills/intent-parser";

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
