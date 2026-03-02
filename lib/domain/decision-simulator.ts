import type { CashflowSnapshot } from "./cashflow-model";

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
