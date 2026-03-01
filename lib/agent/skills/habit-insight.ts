import { openai, isApiKeyValid } from "../openai-client";
import type { HabitCandidate, SurplusSummary } from "@/lib/types";

export interface HabitInsightResult {
  headline: string;
  explanation: string;
  motivationalHook: string;
  actionSuggestion: string;
}

const SYSTEM_PROMPT = `You are Odysseus, a personal finance AI assistant. You explain spending habits clearly and motivationally. You are warm but direct — like a smart friend who cares about your financial future.

Rules:
- Never invent numbers. Only reference the data provided.
- Never give specific investment advice or recommend specific securities.
- Keep language simple and jargon-free.
- Be encouraging, not judgmental. Frame habits as opportunities, not failures.
- Output ONLY valid JSON matching the schema. No markdown, no preamble.`;

const JSON_SCHEMA = {
  name: "habit_insight",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      headline: { type: "string" as const },
      explanation: { type: "string" as const },
      motivationalHook: { type: "string" as const },
      actionSuggestion: { type: "string" as const },
    },
    required: ["headline", "explanation", "motivationalHook", "actionSuggestion"],
    additionalProperties: false,
  },
};

const FALLBACK_RESPONSES: Record<string, HabitInsightResult> = {
  food_delivery: {
    headline: "Your food delivery habit is costing more than you think",
    explanation:
      "Over the past 24 months, you've spent a significant portion of your discretionary budget on food delivery services. The spending is consistent across weekdays and weekends, suggesting it's become a default rather than a conscious choice.",
    motivationalHook:
      "Redirecting even half of this into investments could grow to a meaningful amount over 5 years.",
    actionSuggestion:
      "Start by meal prepping twice a week — small changes compound over time.",
  },
  coffee: {
    headline: "Your daily coffee run adds up fast",
    explanation:
      "Your coffee shop visits are remarkably consistent — almost daily according to the data. While each visit feels small, the monthly total rivals some of your subscription costs.",
    motivationalHook:
      "Brewing at home even half the time could free up cash that grows significantly when invested.",
    actionSuggestion:
      "Try a home brewing setup — the upfront cost pays for itself within a month.",
  },
  coffee_shops: {
    headline: "Your daily coffee run adds up fast",
    explanation:
      "Your coffee shop visits are remarkably consistent — almost daily according to the data. While each visit feels small, the monthly total rivals some of your subscription costs.",
    motivationalHook:
      "Brewing at home even half the time could free up cash that grows significantly when invested.",
    actionSuggestion:
      "Try a home brewing setup — the upfront cost pays for itself within a month.",
  },
  vaping: {
    headline: "Your vaping spend is a quiet budget leak",
    explanation:
      "Vaping purchases show up regularly in your transactions, often multiple times per week. This category is easy to overlook because individual purchases are small, but it's one of your most consistent discretionary expenses.",
    motivationalHook:
      "Cutting back here doesn't just help your wallet — the savings could fund a meaningful investment position over time.",
    actionSuggestion:
      "Consider gradually reducing frequency — even a 25% reduction adds up over a year.",
  },
  alcohol: {
    headline: "Weekend drinks are taking a bigger bite than expected",
    explanation:
      "Your alcohol spending clusters around weekends with occasional weekday appearances. The pattern suggests social spending that's become habitual rather than purely occasional.",
    motivationalHook:
      "Reducing this by half could redirect hundreds per month into building long-term wealth.",
    actionSuggestion:
      "Try alternating between going out and hosting — you'll spend less and still socialize.",
  },
  dining_out: {
    headline: "Dining out is your biggest discretionary expense",
    explanation:
      "Restaurant spending appears throughout the week, with peaks on weekends. This is one of the largest categories in your discretionary budget, and the frequency suggests it's become a go-to rather than a treat.",
    motivationalHook:
      "Even a modest reduction here could meaningfully boost your investment contributions each month.",
    actionSuggestion:
      "Set a weekly dining budget and track it — awareness alone often reduces spending by 20%.",
  },
  impulse_shopping: {
    headline: "Impulse purchases are quietly draining your surplus",
    explanation:
      "Your shopping transactions show a pattern of frequent, small-to-medium purchases across multiple retailers. The variety suggests impulse buying rather than planned purchases.",
    motivationalHook:
      "Implementing a 24-hour rule before non-essential purchases could redirect significant money into your future.",
    actionSuggestion:
      "Try a 24-hour cooling-off period for any non-essential purchase over $30.",
  },
};

function getFallback(habit: HabitCandidate): HabitInsightResult {
  const categoryFallback = FALLBACK_RESPONSES[habit.category];
  if (categoryFallback) return categoryFallback;

  return {
    headline: `Your ${habit.name.toLowerCase()} habit is worth examining`,
    explanation: `Over the past ${habit.metrics.monthsActive} months, this spending pattern has been consistent. At ${habit.merchants.length} merchant${habit.merchants.length > 1 ? "s" : ""}, it represents a real recurring cost in your budget.`,
    motivationalHook:
      "Small, consistent changes in habitual spending can compound into significant wealth over time.",
    actionSuggestion:
      "Start by tracking this category for a week to build awareness — that's often the first step to change.",
  };
}

export async function generateHabitInsight(
  habit: HabitCandidate,
  surplus: SurplusSummary
): Promise<HabitInsightResult> {
  if (!isApiKeyValid()) {
    return getFallback(habit);
  }

  try {
    const userMessage = JSON.stringify({
      habit: {
        name: habit.name,
        merchants: habit.merchants,
        monthlySpend: habit.metrics.monthlySpend,
        weeklyFrequency: habit.metrics.weeklyFrequency,
        yearlyProjection: habit.metrics.yearlyProjection,
        totalSpentAllTime: habit.metrics.totalSpentAllTime,
        dayOfWeekPattern: habit.metrics.dayOfWeekPattern,
        confidence: habit.confidence,
      },
      surplusContext: {
        averageMonthlySurplus: surplus.averageMonthlySurplus,
        averageMonthlyPotentialSurplus: surplus.averageMonthlyPotentialSurplus,
      },
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
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
    if (!content) return getFallback(habit);

    return JSON.parse(content) as HabitInsightResult;
  } catch {
    return getFallback(habit);
  }
}
