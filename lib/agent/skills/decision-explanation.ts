import { openai, isApiKeyValid } from "../openai-client";

export interface DecisionExplanationResult {
  headline: string;
  explanation: string;
  suggestion: string;
}

export interface DecisionExplanationInput {
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
}

const SYSTEM_PROMPT = `You are Odysseus, a personal finance AI. The user is considering a purchase. You have received the structured output of a financial simulation. Your job is to explain the impact clearly and briefly.

Rules:
- Never invent numbers. Only reference the data provided.
- Never tell the user what to do. Present the impact and let them decide.
- Never give investment advice.
- Be warm but direct. Like a smart friend glancing at your bank app with you.
- For "safe" verdicts: be reassuring and brief. Don't over-explain.
- For "tight" verdicts: acknowledge it's doable but flag the tradeoff.
- For "risky" verdicts: be honest about the consequence without being preachy.
- Each field should be 1-2 sentences maximum.
- Output ONLY valid JSON matching the schema. No markdown, no preamble.`;

const JSON_SCHEMA = {
  name: "decision_explanation",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string" as const },
      explanation: { type: "string" as const },
      suggestion: { type: "string" as const },
    },
    required: ["headline", "explanation", "suggestion"],
    additionalProperties: false,
  },
};

const FALLBACKS: Record<
  string,
  (input: DecisionExplanationInput) => DecisionExplanationResult
> = {
  safe: (input) => ({
    headline: "You're clear.",
    explanation: `$${input.proposedAmount} is well within your free cash. Your surplus stays positive and your investment plan stays on track. ${input.daysUntilPay} days until your next payday — no pressure.`,
    suggestion: "No adjustments needed.",
  }),
  tight: (input) => ({
    headline: "This one's tight.",
    explanation: `You can cover $${input.proposedAmount}, but it leaves you with $${Math.round(input.freeCashAfter)} until payday in ${input.daysUntilPay} days. ${input.investmentAtRisk ? "This might reduce your investment contribution this period." : "Your investment plan should still hold."}`,
    suggestion: input.investmentAtRisk
      ? "Consider splitting this across two pay periods."
      : "You'll want to watch your spending for the rest of the week.",
  }),
  risky: (input) => ({
    headline: "This would stretch things.",
    explanation: `$${input.proposedAmount} pushes your free cash negative before your next payday. ${input.streakAtRisk ? "Your investment streak would also be impacted. " : ""}Your buffer drops to ${input.bufferMonths.toFixed(1)} months of essentials.`,
    suggestion:
      "A smaller amount or waiting until after payday would keep your plan intact.",
  }),
};

function getFallback(
  input: DecisionExplanationInput
): DecisionExplanationResult {
  const fn = FALLBACKS[input.verdict];
  if (fn) return fn(input);
  return FALLBACKS.safe(input);
}

export async function generateDecisionExplanation(
  input: DecisionExplanationInput
): Promise<DecisionExplanationResult> {
  if (!isApiKeyValid()) {
    return getFallback(input);
  }

  try {
    const userMessage = JSON.stringify(input);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return getFallback(input);

    return JSON.parse(content) as DecisionExplanationResult;
  } catch {
    return getFallback(input);
  }
}
