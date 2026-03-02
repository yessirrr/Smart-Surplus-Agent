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

export type DecisionExplanationInput = DecisionExplanationInputLegacy | DecisionExplanationInputV2;

const SYSTEM_PROMPT = `You are Odysseus, a personal finance assistant.

You are given deterministic simulation output and factual numbers.
Your job is to explain what it means.

Hard rules:
- Do NOT perform math.
- Do NOT invent numbers.
- Use only provided fields.
- Keep it concise and concrete.
- Output JSON only.

Output fields:
- headline: short, punchy, one line
- explanation: 2-3 short sentences
- suggestion: 1 sentence, practical next action
- confidence: low | medium | high
- assumptions: 0-2 short strings (only if assumptions exist)`;

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
  return `$${abs.toLocaleString("en-CA", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function horizonLabel(horizon: TimeHorizon): string {
  if (horizon.kind === "today") return "today";
  if (horizon.kind === "this_week") return "this week";
  if (horizon.kind === "this_month") return "this month";
  if (horizon.kind === "date") return `${horizon.value}`;
  return `in ${horizon.value} days`;
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
  const cadence = input.cadence === "weekly" ? "/week" : input.cadence === "monthly" ? "/month" : "";
  const divergence =
    input.deltaAt90Days > 20
      ? ` Over 90 days, the modeled gap is ${money(input.deltaAt90Days)}.`
      : "";

  if (input.verdict === "safe") {
    return {
      headline: "This fits your current cashflow.",
      explanation: `${money(input.proposedAmount)}${cadence} stays within your near-term cash and keeps your buffer in healthy range.${divergence}`,
      suggestion: "No change needed if this matches your priority.",
      confidence: "high",
      assumptions: [],
    };
  }

  if (input.verdict === "tight") {
    return {
      headline: "Doable, but tight.",
      explanation: `${money(input.proposedAmount)}${cadence} leaves about ${money(input.freeCashAfter)} until payday in ${input.daysUntilPay} days. Your buffer is around ${input.bufferMonths.toFixed(1)} months after this.${divergence}`,
      suggestion: "Consider splitting this across two pay cycles.",
      confidence: "medium",
      assumptions: [],
    };
  }

  return {
    headline: "This would strain the plan.",
    explanation: `${money(input.proposedAmount)}${cadence} pushes free cash below zero before payday and reduces your safety buffer to ${input.bufferMonths.toFixed(1)} months.${divergence}`,
    suggestion: "Delay or lower the amount to protect your baseline.",
    confidence: "high",
    assumptions: [],
  };
}

function fallbackV2(input: DecisionExplanationInputV2): DecisionExplanationResult {
  const { simulation, facts, intent } = input;
  const confidence = resolveConfidenceV2(input);
  const assumptions = input.assumptions?.slice(0, 2) ?? [];

  if (intent.intentType === "recurring") {
    const drag = facts.recurringImpactMonthly ?? simulation.recurringImpactMonthly ?? 0;
    const explanation =
      simulation.verdict === "risky"
        ? `This adds about ${money(drag)} per month and drives the model into a negative surplus path.`
        : `This adds about ${money(drag)} per month. Free cash after burn is modeled at ${money(simulation.freeCashAfter)} until the next payday.`;

    return {
      headline: simulation.verdict === "safe" ? "Recurring cost is manageable." : simulation.verdict === "tight" ? "Recurring cost compresses your margin." : "Recurring cost is too heavy right now.",
      explanation,
      suggestion:
        simulation.verdict === "risky"
          ? "Lower the monthly amount or offset it with a matching cut."
          : "Track this as a standing monthly drag before committing.",
      confidence,
      assumptions,
    };
  }

  if (intent.intentType === "big_goal") {
    const gap = facts.gapToSafeBudget ?? 0;
    const months = facts.monthsToGoal ?? simulation.monthsToGoal;
    const required = facts.requiredMonthlySavings ?? simulation.monthlySavingsNeeded;

    if (simulation.verdict === "risky") {
      const planLine =
        months && required
          ? `To close the gap, the model suggests about ${money(required)}/month for ${months} months.`
          : "Current cashflow has no modeled savings capacity for this goal yet.";

      return {
        headline: "This needs a savings runway first.",
        explanation: `Your safe one-time budget is ${money(simulation.maxSafeOneTimeSpend ?? 0)}, leaving a gap of ${money(gap)}. ${planLine}`,
        suggestion: "Set a monthly target and revisit once the gap is covered.",
        confidence,
        assumptions,
      };
    }

    return {
      headline: "This can be done inside your buffer rule.",
      explanation: `Modeled safe cap is ${money(simulation.maxSafeOneTimeSpend ?? 0)} with buffer after purchase near ${simulation.bufferMonthsAfter.toFixed(1)} months of essentials.`,
      suggestion: "Proceed only if this goal outranks other near-term priorities.",
      confidence,
      assumptions,
    };
  }

  if (intent.intentType === "planned_purchase") {
    return {
      headline:
        simulation.verdict === "safe"
          ? "Planned date keeps this controlled."
          : simulation.verdict === "tight"
            ? "Purchase timing is workable but thin."
            : "At this timing, cash runs too tight.",
      explanation: `For ${horizonLabel(intent.horizon)}, projected free cash is ${money(facts.projectedFreeCashAtPurchase ?? simulation.freeCashBefore)} before purchase and ${money(simulation.freeCashAfter)} after purchase. Buffer after is ${simulation.bufferMonthsAfter.toFixed(1)} months.`,
      suggestion:
        simulation.verdict === "risky"
          ? "Move the date later or reduce the amount."
          : "Keep this date and avoid extra discretionary spikes before then.",
      confidence,
      assumptions,
    };
  }

  return {
    headline:
      simulation.verdict === "safe"
        ? "This fits your current week."
        : simulation.verdict === "tight"
          ? "This fits, but with less breathing room."
          : "This likely breaks your near-term cash cushion.",
    explanation: `${intent.title} leaves modeled free cash at ${money(simulation.freeCashAfter)} for the ${facts.daysUntilNextPay} days until payday, with buffer after at ${simulation.bufferMonthsAfter.toFixed(1)} months.`,
    suggestion:
      simulation.verdict === "risky"
        ? "Lower the spend or wait until the next pay cycle."
        : "Proceed if you keep the rest of this period lean.",
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

export async function generateDecisionExplanation(
  input: DecisionExplanationInput
): Promise<DecisionExplanationResult> {
  if (!isApiKeyValid()) {
    return getFallback(input);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 240,
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
      return getFallback(input);
    }

    return JSON.parse(content) as DecisionExplanationResult;
  } catch {
    return getFallback(input);
  }
}
