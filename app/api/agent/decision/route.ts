import { NextResponse } from "next/server";
import {
  generateDecisionExplanationWithSource,
  type DecisionExplanationInput,
  type DecisionExplanationInputV2,
} from "@/lib/agent/skills/decision-explanation";

function isV2Input(body: DecisionExplanationInput): body is DecisionExplanationInputV2 {
  return (body as DecisionExplanationInputV2).version === "v2";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DecisionExplanationInput;

    if (isV2Input(body)) {
      if (!body.intent || !body.simulation || !Array.isArray(body.reasonCodes)) {
        return NextResponse.json(
          { error: "intent, simulation, and reasonCodes are required for v2" },
          { status: 400 }
        );
      }

      const { result, source } = await generateDecisionExplanationWithSource(body);
      return NextResponse.json({
        ...result,
        source,
      });
    }

    if (
      typeof (body as { proposedAmount?: unknown }).proposedAmount !== "number" ||
      typeof (body as { verdict?: unknown }).verdict !== "string"
    ) {
      return NextResponse.json(
        { error: "proposedAmount and verdict are required" },
        { status: 400 }
      );
    }

    const { result, source } = await generateDecisionExplanationWithSource(body);
    return NextResponse.json({
      ...result,
      source,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate decision explanation" },
      { status: 500 }
    );
  }
}
