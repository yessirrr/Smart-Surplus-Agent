// Skills
export { generateHabitInsight } from "./skills/habit-insight";
export { generateSurplusNarrative } from "./skills/surplus-narrative";
export { generateAllocationReasoning } from "./skills/allocation-reasoning";
export { generateGoalInsight } from "./skills/goal-insight";
export { generateCommitmentSummary } from "./skills/commitment-summary";
export { generateDecisionExplanation } from "./skills/decision-explanation";
export { parseDecisionIntent } from "./skills/intent-parser";

// Skill result types
export type { HabitInsightResult } from "./skills/habit-insight";
export type { SurplusNarrativeResult, SurplusNarrativeInput } from "./skills/surplus-narrative";
export type {
  AllocationReasoningResult,
  AllocationReasoningInput,
} from "./skills/allocation-reasoning";
export type { GoalInsightResult, GoalInsightInput } from "./skills/goal-insight";
export type { CommitmentSummaryResult, CommitmentSummaryInput } from "./skills/commitment-summary";
export type { DecisionExplanationResult, DecisionExplanationInput } from "./skills/decision-explanation";
export type { DecisionIntent, SpendCadence, TimeHorizon } from "./skills/intent-parser";

// Client hook
export { useAgent } from "./use-agent";
