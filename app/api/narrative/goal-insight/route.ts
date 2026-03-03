import { NextResponse } from "next/server";
import { generateGoalInsight } from "@/lib/narrative/skills/goal-insight";
import type { GoalInsightInput } from "@/lib/narrative/skills/goal-insight";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GoalInsightInput;

    if (!body.habitName || !body.category) {
      return NextResponse.json(
        { error: "habitName and category are required" },
        { status: 400 }
      );
    }

    const result = await generateGoalInsight(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate goal insight" },
      { status: 500 }
    );
  }
}

