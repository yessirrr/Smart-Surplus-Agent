import { NextResponse } from "next/server";
import transactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { generateHabitInsight } from "@/lib/agent/skills/habit-insight";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { habitId } = body as { habitId?: string };

    if (!habitId) {
      return NextResponse.json(
        { error: "habitId is required" },
        { status: 400 }
      );
    }

    const txns = transactions as Transaction[];
    const analysis = analyzeTransactions(txns, {
      frequency: "biweekly",
      dayOfWeek: "friday",
      amount: 2076,
    });

    const habit = analysis.habitCandidates.find((h) => h.id === habitId);
    if (!habit) {
      return NextResponse.json(
        { error: "Habit not found" },
        { status: 404 }
      );
    }

    const result = await generateHabitInsight(habit, analysis.surplusSummary);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate habit insight" },
      { status: 500 }
    );
  }
}
