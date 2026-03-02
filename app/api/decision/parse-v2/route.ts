import { NextResponse } from "next/server";
import {
  buildParseFallbackResponse,
  parseDecisionIntentV2,
} from "@/lib/agent/skills/decision-intent-v2";

export async function POST(request: Request) {
  let input = "";

  try {
    const body = (await request.json()) as { input?: unknown };
    if (typeof body.input === "string") {
      input = body.input.trim();
    }
  } catch {
    input = "";
  }

  if (!input) {
    return NextResponse.json({
      intentType: "impulse",
      amount: null,
      cadence: "one_time",
      horizon: { kind: "this_week" },
      title: "Spending decision",
      categoryHint: null,
      needsClarification: true,
      clarificationQuestion: "What are you considering spending?",
      clarificationFields: ["amount"],
    });
  }

  try {
    const parsed = await parseDecisionIntentV2(input);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(buildParseFallbackResponse(input));
  }
}
