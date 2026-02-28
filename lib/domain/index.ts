import type { Transaction, PaySchedule, FullAnalysis } from "../types";
import { detectRecurringPatterns } from "./recurring-detector";
import { classifyHabits } from "./habit-classifier";
import { computeSurplus } from "./surplus-engine";

/**
 * Orchestrates the full analysis pipeline:
 *   detect recurring → classify habits → compute surplus
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

// Re-export all types
export type {
  Transaction,
  TransactionCategory,
  UserProfile,
  HabitIntensity,
  Timeframe,
  DecisionSource,
  HabitGoal,
  HabitRule,
  HabitLabel,
  SurplusEvent,
  AllocationPlan,
  RecurringPattern,
  HabitCandidate,
  PaySchedule,
  PeriodSurplus,
  SurplusSummary,
  FullAnalysis,
} from "../types";
