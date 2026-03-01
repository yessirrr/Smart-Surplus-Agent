import { NextResponse } from "next/server";
import transactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";
import { analyzeTransactions } from "@/lib/domain";
import { generateSurplusNarrative } from "@/lib/agent/skills/surplus-narrative";

export async function POST() {
  try {
    const txns = transactions as Transaction[];
    const analysis = analyzeTransactions(txns, {
      frequency: "biweekly",
      dayOfWeek: "friday",
      amount: 2076,
    });

    const result = await generateSurplusNarrative(analysis.surplusSummary);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate surplus narrative" },
      { status: 500 }
    );
  }
}
