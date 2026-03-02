import { NextRequest, NextResponse } from "next/server";
import rawTransactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";

const transactions = (rawTransactions as Transaction[]).sort(
  (a, b) => a.date.localeCompare(b.date)
);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const cursor = req.nextUrl.searchParams.get("cursor") ?? "2024-01-01";
  const windowDays = parseInt(
    req.nextUrl.searchParams.get("windowDays") ?? "7",
    10
  );

  const endDate = addDays(cursor, windowDays);

  const added = transactions.filter(
    (t) => t.date >= cursor && t.date < endDate
  );

  const lastDate = transactions[transactions.length - 1]?.date ?? cursor;
  const hasMore = endDate <= lastDate;
  const nextCursor = endDate;

  return NextResponse.json({
    added,
    cursor: nextCursor,
    hasMore,
    syncedThrough: endDate,
  });
}
