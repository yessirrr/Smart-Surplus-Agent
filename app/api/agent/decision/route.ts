import { NextResponse } from "next/server";
import { generateDecisionExplanation } from "@/lib/agent/skills/decision-explanation";
import type { DecisionExplanationInput } from "@/lib/agent/skills/decision-explanation";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DecisionExplanationInput;

    if (
      typeof body.proposedAmount !== "number" ||
      typeof body.verdict !== "string"
    ) {
      return NextResponse.json(
        { error: "proposedAmount and verdict are required" },
        { status: 400 }
      );
    }

    const result = await generateDecisionExplanation(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate decision explanation" },
      { status: 500 }
    );
  }
}
