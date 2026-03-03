import { getModelClient, isProviderKeyConfigured } from "../model-client";

export interface GoalInsightResult {
  behaviorFraming: string;
  motivationalNudge: string;
  investmentHook: string;
}

export interface GoalInsightInput {
  habitName: string;
  category: string;
  currentWeeklyFrequency: number;
  avgCostPerOccurrence: number;
  selectedIntensity: string;
  reductionPercent: number;
  newWeeklyFrequency: number;
  monthlySavings: number;
  yearlySavings: number;
  fiveYearInvestmentValue: number;
}

const SYSTEM_GUIDELINES = `You are Odysseus, a personal finance assistant. You translate abstract percentage reductions into concrete daily/weekly behavioral changes. You make savings feel tangible and achievable.

Rules:
- Never invent numbers. Only reference the data provided.
- Translate percentages into specific behavioral changes (e.g., "3 coffees a week instead of 7")
- Be encouraging and concrete — "You'd still enjoy coffee most workdays" not "Reduce consumption"
- Frame the investment outcome as a reward for the behavioral change
- Keep each field to 1-3 sentences maximum
- Output ONLY valid JSON matching the schema. No markdown, no preamble.`;

const JSON_SCHEMA = {
  name: "goal_insight",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      behaviorFraming: { type: "string" as const },
      motivationalNudge: { type: "string" as const },
      investmentHook: { type: "string" as const },
    },
    required: ["behaviorFraming", "motivationalNudge", "investmentHook"],
    additionalProperties: false,
  },
};

const FALLBACK_RESPONSES: Record<string, GoalInsightResult> = {
  food_delivery: {
    behaviorFraming:
      "Instead of ordering in every other day, you'd cook a few more meals at home each week. You'd still enjoy the occasional delivery — just not on autopilot.",
    motivationalNudge:
      "Most people find that meal prepping even twice a week makes this feel effortless.",
    investmentHook:
      "The money you save could grow into a meaningful investment portfolio over the next 5 years.",
  },
  coffee: {
    behaviorFraming:
      "You'd still grab coffee most workdays — just brew at home a few mornings a week. The ritual stays, the spending drops.",
    motivationalNudge:
      "A good home setup pays for itself in under a month, and the coffee can be just as good.",
    investmentHook:
      "Those saved coffee runs could compound into real wealth when invested consistently.",
  },
  coffee_shops: {
    behaviorFraming:
      "You'd still grab coffee most workdays — just brew at home a few mornings a week. The ritual stays, the spending drops.",
    motivationalNudge:
      "A good home setup pays for itself in under a month, and the coffee can be just as good.",
    investmentHook:
      "Those saved coffee runs could compound into real wealth when invested consistently.",
  },
  vaping: {
    behaviorFraming:
      "This means stepping away from vaping entirely. It's the hardest option, but it's also the most rewarding — for your health and your wallet.",
    motivationalNudge:
      "Many people who quit find the first two weeks are the hardest, then it gets dramatically easier.",
    investmentHook:
      "Every dollar that used to go up in smoke could be building your financial future instead.",
  },
  alcohol: {
    behaviorFraming:
      "You'd still go out with friends — just swap every other round for something non-alcoholic, or host at home more often.",
    motivationalNudge:
      "Social habits are the easiest to shift when you replace them rather than remove them.",
    investmentHook:
      "Redirecting even half your bar tab into investments adds up to a surprisingly large sum over time.",
  },
  dining_out: {
    behaviorFraming:
      "You'd eat out a couple fewer times per week — keeping your favorite spots for the weekends while cooking more during the week.",
    motivationalNudge:
      "Setting a weekly dining budget and tracking it is often enough to naturally reduce spending by 20%.",
    investmentHook:
      "The savings from fewer restaurant meals could fund a solid monthly investment contribution.",
  },
  subscriptions: {
    behaviorFraming:
      "Canceling unused subscriptions is the easiest money to redirect — no behavior change needed, just removing automatic charges you barely notice.",
    motivationalNudge:
      "Most people don't miss canceled subscriptions after the first week. The content you actually watch is probably on one or two services.",
    investmentHook:
      "Subscription savings are the most reliable source of investable cash because they recur automatically every month.",
  },
};

function getFallback(input: GoalInsightInput): GoalInsightResult {
  const categoryFallback = FALLBACK_RESPONSES[input.category];
  if (categoryFallback) return categoryFallback;

  return {
    behaviorFraming: `Reducing your ${input.habitName.toLowerCase()} spending means being a bit more intentional about when you spend. You'd still enjoy it — just less often.`,
    motivationalNudge:
      "Small, consistent changes are more sustainable than dramatic cuts. Start with what feels easy.",
    investmentHook:
      "The money you free up could grow significantly when invested over the next 5 years.",
  };
}

export async function generateGoalInsight(
  input: GoalInsightInput
): Promise<GoalInsightResult> {
  if (!isProviderKeyConfigured()) {
    return getFallback(input);
  }

  try {
    const userMessage = JSON.stringify(input);

    const response = await getModelClient().chat.completions.create({
      model: process.env.MODEL_PROVIDER_MODEL ?? "o4-mini",
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_GUIDELINES },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return getFallback(input);

    return JSON.parse(content) as GoalInsightResult;
  } catch {
    return getFallback(input);
  }
}




