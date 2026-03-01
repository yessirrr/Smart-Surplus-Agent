import { openai, isApiKeyValid } from "../openai-client";

export interface AllocationReasoningInput {
  riskTolerance: string;
  horizon: string;
  planName: string;
  bondsPct: number;
  equityPct: number;
  expectedReturn: number;
  monthlySavings: number;
}

export interface AllocationReasoningResult {
  reasoning: string;
  riskExplanation: string;
  historicalContext: string;
  caveat: string;
}

const SYSTEM_PROMPT = `You are Odysseus, a personal finance AI assistant. You explain investment allocation choices in plain language. You help users understand risk and return tradeoffs without being prescriptive.

Rules:
- Never recommend specific securities, funds, or tickers.
- Never guarantee returns or make promises about future performance.
- Always include that past performance does not guarantee future results.
- Frame the explanation around the user's stated risk tolerance and horizon.
- Be educational, not advisory. You explain, you don't prescribe.
- Output ONLY valid JSON matching the schema.`;

const JSON_SCHEMA = {
  name: "allocation_reasoning",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      reasoning: { type: "string" as const },
      riskExplanation: { type: "string" as const },
      historicalContext: { type: "string" as const },
      caveat: { type: "string" as const },
    },
    required: ["reasoning", "riskExplanation", "historicalContext", "caveat"],
    additionalProperties: false,
  },
};

const FALLBACKS: Record<string, AllocationReasoningResult> = {
  Conservative: {
    reasoning:
      "A conservative allocation prioritizes stability over growth. With 80% in bonds and 20% in equities, this portfolio is designed to preserve your capital while still participating in some market growth. This suits investors who prefer predictability and are uncomfortable with large swings in portfolio value.",
    riskExplanation:
      "Lower risk means smaller ups and downs in your portfolio value. You're less likely to see dramatic drops during market downturns, but your long-term growth potential is also more modest.",
    historicalContext:
      "Historically, bond-heavy portfolios have delivered steady but moderate returns, typically outpacing inflation while providing more stability than equity-focused strategies.",
    caveat:
      "Past performance does not guarantee future results. All investments carry risk, including the potential loss of principal.",
  },
  Balanced: {
    reasoning:
      "A balanced allocation splits between bonds and equities, giving you exposure to growth while maintaining a buffer against volatility. With 60% equities and 40% bonds, this is a classic approach for investors with a medium risk tolerance and a multi-year horizon. It's designed to grow your wealth steadily without the full rollercoaster of an all-equity portfolio.",
    riskExplanation:
      "Moderate risk means you'll experience some portfolio fluctuations, especially during market corrections. However, the bond component helps cushion the impact, and over longer periods, the equity exposure drives meaningful growth.",
    historicalContext:
      "A 60/40 portfolio has been one of the most widely used allocation strategies, historically delivering solid risk-adjusted returns over 5+ year periods.",
    caveat:
      "Past performance does not guarantee future results. All investments carry risk, including the potential loss of principal.",
  },
  Growth: {
    reasoning:
      "A growth allocation maximizes your exposure to equities at 90%, with just 10% in bonds as a small buffer. This is designed for investors who are comfortable with volatility and have a long enough time horizon to ride out market downturns. The higher equity weighting means more potential for growth, but also larger short-term swings.",
    riskExplanation:
      "Higher risk means your portfolio can drop significantly during market downturns — sometimes 20-30% in a bad year. However, for investors with a long horizon, these dips have historically been temporary, and equities have recovered and grown over time.",
    historicalContext:
      "Equity-heavy portfolios have historically delivered the highest long-term returns, though with greater year-to-year volatility. The trade-off tends to favor patient investors.",
    caveat:
      "Past performance does not guarantee future results. All investments carry risk, including the potential loss of principal.",
  },
};

export async function generateAllocationReasoning(
  input: AllocationReasoningInput
): Promise<AllocationReasoningResult> {
  if (!isApiKeyValid()) {
    return FALLBACKS[input.planName] ?? FALLBACKS["Balanced"];
  }

  try {
    const userMessage = JSON.stringify({
      riskTolerance: input.riskTolerance,
      investmentHorizon: input.horizon,
      selectedPlan: {
        name: input.planName,
        bondsPct: input.bondsPct,
        equityPct: input.equityPct,
        expectedReturn: input.expectedReturn,
      },
      monthlySavingsAmount: Math.round(input.monthlySavings),
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
    if (!content) return FALLBACKS[input.planName] ?? FALLBACKS["Balanced"];

    return JSON.parse(content) as AllocationReasoningResult;
  } catch {
    return FALLBACKS[input.planName] ?? FALLBACKS["Balanced"];
  }
}
