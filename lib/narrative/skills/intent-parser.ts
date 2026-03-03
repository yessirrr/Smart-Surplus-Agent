import { getModelClient, isProviderKeyConfigured } from "../model-client";

export type SpendCadence = "one_time" | "weekly" | "monthly";
export type TimeHorizon = "today" | "this_week" | "this_month";

export interface DecisionIntent {
  amount: number | null;
  cadence: SpendCadence | null;
  horizon: TimeHorizon | null;
  categoryHint: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
}

const SYSTEM_GUIDELINES = `You are a financial intent parser. The user is describing a potential purchase or recurring expense. Extract structured fields from their natural language input.

Rules:
- Extract the dollar amount if mentioned. Remove currency symbols and parse to a number.
- Infer cadence: "one_time" for single purchases, "weekly" for per-week expenses, "monthly" for per-month/subscription expenses. If ambiguous (e.g. "drinks tonight" with no frequency cue), default to "one_time".
- Infer horizon: "today" if they mention tonight/today/now, "this_week" if they mention this week/soon, "this_month" for monthly/recurring. Default to "this_week" if unclear.
- Infer categoryHint from context: "dining", "alcohol", "entertainment", "shopping", "transportation", "subscription", "housing", etc. Null if unclear.
- If the amount is completely missing or ambiguous, set needsClarification to true and clarificationQuestion to "How much are you considering spending?"
- If the amount is present but cadence is genuinely ambiguous (e.g. "car payment of $300" — could be one-time or monthly), set needsClarification to true and clarificationQuestion to "Is this a one-time expense or a recurring monthly payment?"
- Do NOT ask for clarification on horizon — just default to "this_week".
- Output ONLY valid JSON. No markdown, no preamble.`;

const JSON_SCHEMA = {
  name: "decision_intent",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      amount: { type: ["number", "null"] as const },
      cadence: {
        type: ["string", "null"] as const,
        enum: ["one_time", "weekly", "monthly", null],
      },
      horizon: {
        type: ["string", "null"] as const,
        enum: ["today", "this_week", "this_month", null],
      },
      categoryHint: { type: ["string", "null"] as const },
      needsClarification: { type: "boolean" as const },
      clarificationQuestion: { type: ["string", "null"] as const },
    },
    required: [
      "amount",
      "cadence",
      "horizon",
      "categoryHint",
      "needsClarification",
      "clarificationQuestion",
    ],
    additionalProperties: false,
  },
};

/**
 * Fallback parser using regex when no API key is available.
 * Extracts dollar amounts and infers cadence from keywords.
 */
function fallbackParse(input: string): DecisionIntent {
  // Extract dollar amount
  const amountMatch = input.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  const plainMatch = !amountMatch
    ? input.match(/(\d{2,}(?:\.\d{1,2})?)/)
    : null;
  const rawAmount = amountMatch?.[1] ?? plainMatch?.[1] ?? null;
  const amount = rawAmount ? parseFloat(rawAmount.replace(/,/g, "")) : null;

  if (amount === null || isNaN(amount)) {
    return {
      amount: null,
      cadence: null,
      horizon: "this_week",
      categoryHint: null,
      needsClarification: true,
      clarificationQuestion: "How much are you considering spending?",
    };
  }

  // Infer cadence
  const lower = input.toLowerCase();
  let cadence: SpendCadence | null = "one_time";
  let needsCadenceClarification = false;

  if (/\b(per\s*week|weekly|\/\s*w(ee)?k|every\s*week)\b/.test(lower)) {
    cadence = "weekly";
  } else if (
    /\b(per\s*month|monthly|\/\s*mo(nth)?|subscription|every\s*month|recurring)\b/.test(
      lower
    )
  ) {
    cadence = "monthly";
  } else if (/\b(car\s*payment|lease|rent|membership|plan)\b/.test(lower)) {
    // Ambiguous — could be monthly
    cadence = null;
    needsCadenceClarification = true;
  }

  // Infer horizon
  let horizon: TimeHorizon = "this_week";
  if (/\b(tonight|today|right\s*now|now)\b/.test(lower)) {
    horizon = "today";
  } else if (/\b(this\s*month|monthly|next\s*month)\b/.test(lower)) {
    horizon = "this_month";
  }

  // Infer category hint
  let categoryHint: string | null = null;
  if (/\b(drink|bar|beer|wine|alcohol)\b/.test(lower))
    categoryHint = "alcohol";
  else if (/\b(dinner|lunch|restaurant|eat|food|meal)\b/.test(lower))
    categoryHint = "dining";
  else if (/\b(coffee|cafe|latte)\b/.test(lower)) categoryHint = "coffee";
  else if (/\b(uber|lyft|taxi|ride|trip)\b/.test(lower))
    categoryHint = "transportation";
  else if (/\b(couch|furniture|clothes|shoes|buy|purchase|shop)\b/.test(lower))
    categoryHint = "shopping";
  else if (/\b(netflix|spotify|subscription|streaming)\b/.test(lower))
    categoryHint = "subscription";
  else if (/\b(concert|movie|game|ticket|show)\b/.test(lower))
    categoryHint = "entertainment";

  return {
    amount,
    cadence: needsCadenceClarification ? null : cadence,
    horizon,
    categoryHint,
    needsClarification: needsCadenceClarification,
    clarificationQuestion: needsCadenceClarification
      ? "Is this a one-time expense or a recurring monthly payment?"
      : null,
  };
}

export async function parseDecisionIntent(
  input: string
): Promise<DecisionIntent> {
  if (!isProviderKeyConfigured()) {
    return fallbackParse(input);
  }

  try {
    const response = await getModelClient().chat.completions.create({
      model: process.env.MODEL_PROVIDER_MODEL ?? "o4-mini",
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_GUIDELINES },
        { role: "user", content: input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallbackParse(input);

    const parsed = JSON.parse(content) as DecisionIntent;

    // Validate and coerce
    if (parsed.amount !== null && (typeof parsed.amount !== "number" || isNaN(parsed.amount))) {
      parsed.amount = null;
      parsed.needsClarification = true;
      parsed.clarificationQuestion = "How much are you considering spending?";
    }

    if (parsed.cadence && !["one_time", "weekly", "monthly"].includes(parsed.cadence)) {
      parsed.cadence = "one_time";
    }

    if (parsed.horizon && !["today", "this_week", "this_month"].includes(parsed.horizon)) {
      parsed.horizon = "this_week";
    }

    return parsed;
  } catch {
    return fallbackParse(input);
  }
}




