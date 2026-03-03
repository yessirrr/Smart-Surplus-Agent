import type { DecisionSimulationV2 } from "@/lib/domain/decision-simulator";
import type { IntentType, SpendCadence, TimeHorizon } from "@/lib/domain/decision-intent";
import { openai, isApiKeyValid } from "../openai-client";

export interface DecisionExplanationResult {
  headline: string;
  explanation: string;
  suggestion: string;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
}

export type ExplanationSource = "openai" | "fallback";

export interface DecisionExplanationInputLegacy {
  proposedAmount: number;
  verdict: "safe" | "tight" | "risky";
  verdictReasons: string[];
  freeCashBefore: number;
  freeCashAfter: number;
  daysUntilPay: number;
  surplusBefore: number;
  surplusAfter: number;
  bufferMonths: number;
  investmentAtRisk: boolean;
  streakAtRisk: boolean;
  cadence: "one_time" | "weekly" | "monthly" | null;
  horizon: "today" | "this_week" | "this_month" | null;
  deltaAt90Days: number;
  assumption: string;
}

export interface DecisionExplanationIntentSummary {
  title: string;
  intentType: IntentType;
  cadence: SpendCadence;
  horizon: TimeHorizon;
  categoryHint?: string | null;
}

export interface DecisionExplanationFacts {
  freeCashUntilPay: number;
  daysUntilNextPay: number;
  bufferMonthsBefore: number;
  bufferMonthsAfter: number;
  monthlySurplus: number;
  potentialSurplus: number;
  monthlyIncome: number;
  monthlyEssentials: number;
  monthlyDiscretionary: number;
  projectedDate?: string | null;
  daysUntilPurchase?: number | null;
  projectedFreeCashAtPurchase?: number | null;
  bufferAtPurchase?: number | null;
  recurringImpactMonthly?: number | null;
  gapToSafeBudget?: number | null;
  monthsToGoal?: number | null;
  requiredMonthlySavings?: number | null;
  targetBufferMonths?: number | null;
  divergenceDelta90d?: number | null;
}

export interface DecisionExplanationInputV2 {
  version: "v2";
  intent: DecisionExplanationIntentSummary;
  simulation: DecisionSimulationV2;
  facts: DecisionExplanationFacts;
  reasonCodes: string[];
  clarificationUsed?: boolean;
  assumptions?: string[];
}

export type DecisionExplanationInput =
  | DecisionExplanationInputLegacy
  | DecisionExplanationInputV2;

const SYSTEM_PROMPT = `You are Odysseus, a personal finance assistant.

You receive deterministic simulation results and factual numbers.
Your role is to explain the result, not compute it.

Hard rules:
- Do NOT do any math.
- Do NOT invent any number.
- Use only supplied values and labels.
- Keep language plain and human.
- Keep recommendation singular and clear.
- Never use these phrases: "free cash", "buffer months", "daily burn rate".
- Translate safety language to "emergency cushion" and "minimum safety cushion".
- Output strict JSON only.

Output:
- headline: one short human sentence
- explanation: max 2 sentences, concrete consequence first
- suggestion: exactly 1 actionable sentence
- confidence: low | medium | high
- assumptions: 0-2 short strings when assumptions were used`;
const JSON_SCHEMA = {
  name: "decision_explanation_v2",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string" as const },
      explanation: { type: "string" as const },
      suggestion: { type: "string" as const },
      confidence: {
        type: "string" as const,
        enum: ["low", "medium", "high"],
      },
      assumptions: {
        type: "array" as const,
        items: { type: "string" as const },
      },
    },
    required: ["headline", "explanation", "suggestion", "confidence", "assumptions"],
    additionalProperties: false,
  },
};

function isV2Input(input: DecisionExplanationInput): input is DecisionExplanationInputV2 {
  return (input as DecisionExplanationInputV2).version === "v2";
}

function money(n: number): string {
  const abs = Math.abs(n);
  const hasCents = Math.abs(abs % 1) > 0;
  return `$${abs.toLocaleString("en-CA", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function resolveConfidenceV2(input: DecisionExplanationInputV2): "low" | "medium" | "high" {
  if (input.clarificationUsed) {
    return "low";
  }

  if (
    input.simulation.meta.intentType === "planned_purchase" ||
    input.reasonCodes.includes("FUTURE_DATE_EVAL") ||
    (input.assumptions?.length ?? 0) > 0
  ) {
    return "medium";
  }

  return "high";
}

function fallbackLegacy(input: DecisionExplanationInputLegacy): DecisionExplanationResult {
  const cadence =
    input.cadence === "weekly"
      ? "/week"
      : input.cadence === "monthly"
        ? "/month"
        : "";

  const divergence =
    input.deltaAt90Days > 20
      ? ` Over 90 days, the modeled gap is ${money(input.deltaAt90Days)}.`
      : "";

  if (input.verdict === "safe") {
    return {
      headline: "You’re clear.",
      explanation: `${money(input.proposedAmount)}${cadence} keeps your account above $0 before your next paycheck and keeps your emergency cushion intact.${divergence}`,
      suggestion: "Proceed if this is still your priority.",
      confidence: "high",
      assumptions: [],
    };
  }

  if (input.verdict === "tight") {
    return {
      headline: "This stretches your cushion.",
      explanation: `${money(input.proposedAmount)}${cadence} keeps you above $0 before your next paycheck, but your emergency cushion gets thinner.${divergence}`,
      suggestion: "Reduce the amount or split it across pay cycles.",
      confidence: "medium",
      assumptions: [],
    };
  }

  return {
    headline: "This breaks your safety rule.",
    explanation: `${money(input.proposedAmount)}${cadence} makes your account dip below $0 before your next paycheck and weakens your emergency cushion.${divergence}`,
    suggestion: "Delay or reduce the spend.",
    confidence: "high",
    assumptions: [],
  };
}
function fallbackV2(input: DecisionExplanationInputV2): DecisionExplanationResult {
  const { simulation, facts, intent } = input;
  const confidence = resolveConfidenceV2(input);
  const assumptions = input.assumptions?.slice(0, 2) ?? [];

  const action = simulation.recommendedAction;

  if (intent.intentType === "planned_purchase") {
    const projected = facts.projectedFreeCashAtPurchase ?? simulation.freeCashBefore;
    const dateLabel = simulation.projectedDate ?? facts.projectedDate ?? "your target date";
    const safeDateLine = simulation.bestSafeDate
      ? `Earliest safe date is ${simulation.bestSafeDate}.`
      : "No safe date appears in the current search window.";

    return {
      headline:
        projected < 0
          ? "This breaks your safety rule."
          : simulation.bufferMonthsAfter < simulation.targetBufferMonths
            ? "This stretches your cushion."
            : "You’re clear.",
      explanation:
        projected < 0
          ? `On ${dateLabel}, your projected account balance after purchase is ${money(simulation.freeCashAfter)} and goes below $0. Emergency cushion after purchase is ${simulation.bufferMonthsAfter.toFixed(1)} months of essentials.`
          : `On ${dateLabel}, projected account balance after purchase is ${money(simulation.freeCashAfter)} and stays above $0. Emergency cushion after purchase is ${simulation.bufferMonthsAfter.toFixed(1)} months of essentials.`,
      suggestion:
        simulation.verdict === "risky"
          ? safeDateLine
          : `${action.title}. ${action.detail}`,
      confidence,
      assumptions,
    };
  }

  if (intent.intentType === "big_goal") {
    const gap = facts.gapToSafeBudget ?? simulation.gapToSafeBudget ?? 0;
    const months = facts.monthsToGoal ?? simulation.monthsToGoal;
    const required =
      facts.requiredMonthlySavings ?? simulation.monthlySavingsNeeded;

    const planLine =
      months && required
        ? `To safely afford this goal, save ${money(required)}/month for ${months} months.`
        : "Current monthly surplus does not show a safe savings path yet.";

    return {
      headline:
        simulation.verdict === "safe"
          ? "You’re clear."
          : "This breaks your safety rule.",
      explanation:
        simulation.verdict === "safe"
          ? `Safe budget today is ${money(simulation.maxSafeOneTimeSpend ?? 0)}, so this goal stays inside your minimum safety cushion.`
          : `Safe budget today is ${money(simulation.maxSafeOneTimeSpend ?? 0)}, leaving a gap of ${money(gap)}. ${planLine}`,
      suggestion: `${action.title}. ${action.detail}`,
      confidence,
      assumptions,
    };
  }

  if (intent.intentType === "recurring") {
    const drag = facts.recurringImpactMonthly ?? simulation.recurringImpactMonthly ?? 0;
    const newSurplus = simulation.newPotentialSurplus ?? facts.potentialSurplus;

    return {
      headline:
        newSurplus < 0
          ? "This breaks your safety rule."
          : simulation.verdict === "tight"
            ? "This stretches your cushion."
            : "You’re clear.",
      explanation: `This adds ${money(drag)}/month of monthly drag. New monthly surplus is ${money(newSurplus)}.`,
      suggestion: `${action.title}. ${action.detail}`,
      confidence,
      assumptions,
    };
  }

  const dipsBelowZero = simulation.freeCashAfter < 0;
  return {
    headline:
      simulation.verdict === "safe"
        ? "You’re clear."
        : simulation.verdict === "tight"
          ? "This stretches your cushion."
          : "This breaks your safety rule.",
    explanation: dipsBelowZero
      ? `${intent.title} makes your account dip below $0 before your next paycheck. Emergency cushion after this decision is ${simulation.bufferMonthsAfter.toFixed(1)} months of essentials.`
      : `${intent.title} keeps your account above $0 before your next paycheck. Emergency cushion after this decision is ${simulation.bufferMonthsAfter.toFixed(1)} months of essentials.`,
    suggestion: `${action.title}. ${action.detail}`,
    confidence,
    assumptions,
  };
}
function getFallback(input: DecisionExplanationInput): DecisionExplanationResult {
  if (isV2Input(input)) {
    return fallbackV2(input);
  }

  return fallbackLegacy(input);
}

export async function generateDecisionExplanationWithSource(
  input: DecisionExplanationInput
): Promise<{ result: DecisionExplanationResult; source: ExplanationSource }> {
  if (!isApiKeyValid()) {
    return {
      result: getFallback(input),
      source: "fallback",
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 260,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        result: getFallback(input),
        source: "fallback",
      };
    }

    return {
      result: JSON.parse(content) as DecisionExplanationResult,
      source: "openai",
    };
  } catch {
    return {
      result: getFallback(input),
      source: "fallback",
    };
  }
}

export async function generateDecisionExplanation(
  input: DecisionExplanationInput
): Promise<DecisionExplanationResult> {
  const { result } = await generateDecisionExplanationWithSource(input);
  return result;
}
