import { NextResponse } from "next/server";
import transactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { generateHabitInsight } from "@/lib/narrative/skills/habit-insight";
import { buildRecurringHabit } from "@/lib/utils/build-recurring-habit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { habitId, confirmedSpend, confirmedCount, goalMode } = body as {
      habitId?: string;
      confirmedSpend?: number;
      confirmedCount?: number;
      goalMode?: string;
    };

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

    const recurringHabit = buildRecurringHabit(analysis.recurringPatterns, txns);
    const allHabits = recurringHabit
      ? [...analysis.habitCandidates, recurringHabit]
      : analysis.habitCandidates;

    const habit = allHabits.find((h) => h.id === habitId);
    if (!habit) {
      return NextResponse.json(
        { error: "Habit not found" },
        { status: 404 }
      );
    }

    const result = await generateHabitInsight(habit, analysis.surplusSummary, {
      confirmedSpend:
        typeof confirmedSpend === "number" && Number.isFinite(confirmedSpend)
          ? Math.max(0, confirmedSpend)
          : undefined,
      confirmedCount:
        typeof confirmedCount === "number" && Number.isFinite(confirmedCount)
          ? Math.max(0, Math.floor(confirmedCount))
          : undefined,
      goalMode: typeof goalMode === "string" ? goalMode : undefined,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate habit insight" },
      { status: 500 }
    );
  }
}

