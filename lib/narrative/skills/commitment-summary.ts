import { getModelClient, isProviderKeyConfigured } from "../model-client";

export interface CommitmentSummaryResult {
  reflection: string;
  costOfSlips: string;
  projection: string;
}

export interface CommitmentSummaryInput {
  totalBeats: number;
  cleanBeats: number;
  slipBeats: number;
  weeklyAmount: number;
  totalInvested: number;
  totalHeld: number;
  portfolioValue: number;
}

const SYSTEM_GUIDELINES = `You are Odysseus, a personal finance advisor. You just watched a user's commitment to eliminate vaping play out over several weeks. Summarize what happened with precision and warmth. Be brief — three short fields, each 1-2 sentences maximum. Reference the exact numbers provided. Do not invent data. Do not give investment advice. Frame slips as learning moments, not failures. The tone is: a coach reviewing game tape with an athlete. Direct, specific, encouraging.`;

const JSON_SCHEMA = {
  name: "commitment_summary",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      reflection: { type: "string" as const },
      costOfSlips: { type: "string" as const },
      projection: { type: "string" as const },
    },
    required: ["reflection", "costOfSlips", "projection"],
    additionalProperties: false,
  },
};

function getFallback(input: CommitmentSummaryInput): CommitmentSummaryResult {
  const complianceRate = Math.round((input.cleanBeats / input.totalBeats) * 100);
  const annualProjection = input.weeklyAmount * 52 * (input.cleanBeats / input.totalBeats);
  return {
    reflection: `You held your commitment ${input.cleanBeats} out of ${input.totalBeats} weeks — a ${complianceRate}% success rate. That's real behavioral change.`,
    costOfSlips: `Your ${input.slipBeats} slip${input.slipBeats === 1 ? "" : "s"} held $${Math.round(input.totalHeld)} back from your portfolio — roughly $${Math.round(input.totalHeld * 1.4)} in lost 5-year growth.`,
    projection: `At this rate, you'd invest approximately $${Math.round(annualProjection).toLocaleString()} in your first year.`,
  };
}

export async function generateCommitmentSummary(
  input: CommitmentSummaryInput
): Promise<CommitmentSummaryResult> {
  if (!isProviderKeyConfigured()) {
    return getFallback(input);
  }

  try {
    const userMessage = JSON.stringify(input);

    const response = await getModelClient().chat.completions.create({
      model: process.env.MODEL_PROVIDER_MODEL ?? "o4-mini",
      max_tokens: 200,
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

    return JSON.parse(content) as CommitmentSummaryResult;
  } catch {
    return getFallback(input);
  }
}




