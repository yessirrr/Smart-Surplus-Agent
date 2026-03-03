// Skills
export { generateHabitInsight } from "./skills/habit-insight";
export { generateSurplusNarrative } from "./skills/surplus-narrative";
export { generateAllocationReasoning } from "./skills/allocation-reasoning";
export { generateGoalInsight } from "./skills/goal-insight";
export { generateCommitmentSummary } from "./skills/commitment-summary";
export { generateDecisionExplanation } from "./skills/decision-explanation";
export { parseDecisionIntent } from "./skills/intent-parser";
export { parseDecisionIntentV2, toDecisionIntent } from "./skills/decision-intent-v2";

// Skill result types
export type { HabitInsightResult } from "./skills/habit-insight";
export type { SurplusNarrativeResult, SurplusNarrativeInput } from "./skills/surplus-narrative";
export type {
  AllocationReasoningResult,
  AllocationReasoningInput,
} from "./skills/allocation-reasoning";
export type { GoalInsightResult, GoalInsightInput } from "./skills/goal-insight";
export type { CommitmentSummaryResult, CommitmentSummaryInput } from "./skills/commitment-summary";
export type {
  DecisionExplanationResult,
  DecisionExplanationInput,
  DecisionExplanationInputV2,
} from "./skills/decision-explanation";
export type { DecisionIntent as LegacyDecisionIntent, SpendCadence as LegacySpendCadence, TimeHorizon as LegacyTimeHorizon } from "./skills/intent-parser";
export type {
  ParsedDecisionIntentV2,
  ClarificationField,
} from "./skills/decision-intent-v2";

// Client hook
export { useRequest } from "./use-request";

