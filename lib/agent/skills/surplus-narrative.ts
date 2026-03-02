import { openai, isApiKeyValid } from "../openai-client";
import type { SurplusSummary } from "@/lib/types";

export interface SurplusNarrativeResult {
  situationSummary: string;
  trendAnalysis: string;
  opportunityStatement: string;
  projectionNote: string;
}

export interface SurplusNarrativeInput {
  selectedHabits?: Array<{ name: string; category: string; monthlySpend: number }>;
  totalMonthlySavings?: number;
  actualSurplus?: number;
  potentialSurplus?: number;
}

const BASE_SYSTEM_PROMPT = `You are Odysseus, a personal finance AI assistant. You summarize a user's surplus situation clearly and motivationally. You see the full picture — income, essential costs, discretionary spending, and habit-linked leaks.

Rules:
- Never invent numbers. Only reference the data provided.
- Never give specific investment advice.
- Be concise: each field should be 1-3 sentences maximum.
- Frame the gap between actual and potential surplus as an opportunity, not a criticism.
- When the user has selected specific habits to address, tailor your response to those specific habits. Reference them by name. Be specific about the combined savings and what they could become if invested. If only one habit is selected, focus entirely on that one. If multiple are selected, describe the combined impact.
- Output ONLY valid JSON matching the schema.`;

const JSON_SCHEMA = {
  name: "surplus_narrative",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      situationSummary: { type: "string" as const },
      trendAnalysis: { type: "string" as const },
      opportunityStatement: { type: "string" as const },
      projectionNote: { type: "string" as const },
    },
    required: [
      "situationSummary",
      "trendAnalysis",
      "opportunityStatement",
      "projectionNote",
    ],
    additionalProperties: false,
  },
};

const FALLBACK: SurplusNarrativeResult = {
  situationSummary:
    "You're earning a solid income and covering your essentials comfortably. After rent, utilities, groceries, and other necessities, you still have room in your budget — but a chunk of your discretionary spending is going to habits that could be optimized.",
  trendAnalysis:
    "Your surplus has been relatively stable over the past 24 months, with some month-to-month variation driven by seasonal spending and occasional splurges.",
  opportunityStatement:
    "The gap between your actual and potential surplus represents money that's currently going to habitual spending. By adjusting even a few of these patterns, you could meaningfully increase the amount flowing into investments each month.",
  projectionNote:
    "Consistently investing your potential surplus at historical market returns could build a significant portfolio over the next 5-10 years.",
};

function getContextFallback(context: SurplusNarrativeInput): SurplusNarrativeResult {
  const habitNames = context.selectedHabits?.map(h => h.name).join(" and ") ?? "your habits";
  const savings = context.totalMonthlySavings ?? 0;
  const fv5 = savings > 0 ? savings * ((Math.pow(1 + 0.07 / 12, 60) - 1) / (0.07 / 12)) : 0;
  return {
    situationSummary: `You've chosen to focus on ${habitNames}. Together, these represent $${Math.round(savings)} per month in potential savings.`,
    trendAnalysis: "Your spending in these categories has been consistent over the past 24 months, which means the savings potential is reliable — not a one-month anomaly.",
    opportunityStatement: `Redirecting $${Math.round(savings)} per month into a balanced portfolio could grow to approximately $${Math.round(fv5).toLocaleString()} over 5 years at historical returns.`,
    projectionNote: "These projections use a 7% annual return assumption. Actual results will vary. The key insight: consistent small redirections compound meaningfully.",
  };
}

export async function generateSurplusNarrative(
  surplus: SurplusSummary,
  context?: SurplusNarrativeInput
): Promise<SurplusNarrativeResult> {
  if (!isApiKeyValid()) {
    if (context?.selectedHabits && context.selectedHabits.length > 0) {
      return getContextFallback(context);
    }
    return FALLBACK;
  }

  try {
    const topCategories = [...surplus.categoryBreakdown]
      .sort((a, b) => b.monthlyAverage - a.monthlyAverage)
      .slice(0, 3)
      .map((c) => ({
        category: c.category,
        monthlyAverage: Math.round(c.monthlyAverage),
        isEssential: c.isEssential,
      }));

    const baseData = {
      averageMonthlySurplus: Math.round(surplus.averageMonthlySurplus),
      averageMonthlyPotentialSurplus: Math.round(
        surplus.averageMonthlyPotentialSurplus
      ),
      totalHabitSpend: Math.round(surplus.totalHabitSpend),
      surplusTrend: surplus.surplusTrend,
      topCategories,
    };

    const userPayload = context?.selectedHabits
      ? {
          ...baseData,
          selectedHabits: context.selectedHabits,
          totalMonthlySavings: context.totalMonthlySavings,
          potentialSurplus: context.potentialSurplus,
        }
      : baseData;

    const userMessage = JSON.stringify(userPayload);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: BASE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      if (context?.selectedHabits && context.selectedHabits.length > 0) {
        return getContextFallback(context);
      }
      return FALLBACK;
    }

    return JSON.parse(content) as SurplusNarrativeResult;
  } catch {
    if (context?.selectedHabits && context.selectedHabits.length > 0) {
      return getContextFallback(context);
    }
    return FALLBACK;
  }
}
