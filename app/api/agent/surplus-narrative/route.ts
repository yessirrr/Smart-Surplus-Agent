import { NextResponse } from "next/server";
import transactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { generateSurplusNarrative } from "@/lib/agent/skills/surplus-narrative";
import type { SurplusNarrativeInput } from "@/lib/agent/skills/surplus-narrative";

export async function POST(request: Request) {
  try {
    const txns = transactions as Transaction[];
    const analysis = analyzeTransactions(txns, {
      frequency: "biweekly",
      dayOfWeek: "friday",
      amount: 2076,
    });

    let context: SurplusNarrativeInput | undefined;

    const contentType = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      try {
        const body = (await request.json()) as SurplusNarrativeInput;
        if (body.selectedHabits && body.selectedHabits.length > 0) {
          context = body;
        }
      } catch {
        // Empty or invalid body — proceed without context
      }
    }

    const result = await generateSurplusNarrative(
      analysis.surplusSummary,
      context
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate surplus narrative" },
      { status: 500 }
    );
  }
}
