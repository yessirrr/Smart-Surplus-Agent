// Skills
export { generateHabitInsight } from "./skills/habit-insight";
export { generateSurplusNarrative } from "./skills/surplus-narrative";
export { generateAllocationReasoning } from "./skills/allocation-reasoning";

// Skill result types
export type { HabitInsightResult } from "./skills/habit-insight";
export type { SurplusNarrativeResult } from "./skills/surplus-narrative";
export type {
  AllocationReasoningResult,
  AllocationReasoningInput,
} from "./skills/allocation-reasoning";

// Client hook
export { useAgent } from "./use-agent";
