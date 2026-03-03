import { NextResponse } from "next/server";
import {
  generateAllocationReasoning,
  type AllocationReasoningInput,
} from "@/lib/narrative/skills/allocation-reasoning";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AllocationReasoningInput;

    if (!body.planName || body.monthlySavings == null) {
      return NextResponse.json(
        { error: "planName and monthlySavings are required" },
        { status: 400 }
      );
    }

    const result = await generateAllocationReasoning(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate allocation reasoning" },
      { status: 500 }
    );
  }
}

