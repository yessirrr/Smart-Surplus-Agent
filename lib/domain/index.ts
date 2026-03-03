import type { FullAnalysis, PaySchedule, Transaction } from "../types";
import { detectRecurringPatterns } from "./recurring-detector";
import { classifyHabits } from "./habit-classifier";
import { computeSurplus } from "./surplus-engine";

/**
 * Orchestrates the full analysis pipeline:
 * detect recurring -> classify habits -> compute surplus.
 *
 * paySchedule stays in this contract for cross-domain consistency.
 * The current computeSurplus implementation is intentionally ledger-driven
 * and does not yet model pay-timing effects.
 */
export function analyzeTransactions(
  transactions: Transaction[],
  paySchedule: PaySchedule
): FullAnalysis {
  const recurringPatterns = detectRecurringPatterns(transactions);
  const habitCandidates = classifyHabits(transactions, recurringPatterns);
  const surplusSummary = computeSurplus(transactions, habitCandidates, paySchedule);

  return {
    recurringPatterns,
    habitCandidates,
    surplusSummary,
    generatedAt: new Date().toISOString(),
  };
}

// Re-export all domain functions
export { detectRecurringPatterns } from "./recurring-detector";
export { classifyHabits } from "./habit-classifier";
export { computeSurplus } from "./surplus-engine";
export { buildCashflowSnapshot, computeDaysUntilNextPay } from "./cashflow-model";
export { deriveForecastSeed, forecastVariableSpendUntilNextPay } from "./spending-forecast";
export { computeForecastFreeCash, evaluateDecisionPolicy } from "./policy-evaluator";
export { boxMuller, mulberry32, quantile } from "./prng";

// Re-export all types
export type {
  AllocationPlan,
  DecisionSource,
  FullAnalysis,
  HabitCandidate,
  HabitGoal,
  HabitIntensity,
  HabitLabel,
  HabitRule,
  PaySchedule,
  PeriodSurplus,
  RecurringPattern,
  SpendingForecast,
  SurplusEvent,
  SurplusSummary,
  Timeframe,
  Transaction,
  TransactionCategory,
  UserProfile,
} from "../types";


