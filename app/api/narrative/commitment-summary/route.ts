import { NextResponse } from "next/server";
import { generateCommitmentSummary } from "@/lib/narrative/skills/commitment-summary";
import type { CommitmentSummaryInput } from "@/lib/narrative/skills/commitment-summary";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CommitmentSummaryInput;

    if (
      typeof body.totalBeats !== "number" ||
      typeof body.cleanBeats !== "number" ||
      typeof body.weeklyAmount !== "number"
    ) {
      return NextResponse.json(
        { error: "totalBeats, cleanBeats, and weeklyAmount are required" },
        { status: 400 }
      );
    }

    const result = await generateCommitmentSummary(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate commitment summary" },
      { status: 500 }
    );
  }
}

