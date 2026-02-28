import type { Transaction, RecurringPattern, TransactionCategory } from "../types";

/**
 * Analyzes raw transactions and detects recurring payment patterns.
 * Discovers patterns purely from transaction history — no pre-labeled flags.
 */
export function detectRecurringPatterns(
  transactions: Transaction[]
): RecurringPattern[] {
  if (transactions.length === 0) return [];

  // Group transactions by merchant
  const byMerchant = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    if (txn.amount >= 0) continue; // skip income/credits
    const list = byMerchant.get(txn.merchant);
    if (list) {
      list.push(txn);
    } else {
      byMerchant.set(txn.merchant, [txn]);
    }
  }

  const patterns: RecurringPattern[] = [];

  for (const [merchant, txns] of byMerchant) {
    // Skip merchants with fewer than 3 occurrences
    if (txns.length < 3) continue;

    // Sort by date ascending
    const sorted = [...txns].sort(
      (a, b) => toEpochDay(a.date) - toEpochDay(b.date)
    );

    // Compute intervals (in days) between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(toEpochDay(sorted[i].date) - toEpochDay(sorted[i - 1].date));
    }

    // Compute median interval
    const medianInterval = median(intervals);

    // Classify frequency based on median interval
    const frequency = classifyFrequency(medianInterval);

    // Compute consistency score from coefficient of variation
    const consistencyScore = computeConsistency(intervals);

    // Compute average amount and amount variance
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const avgAmount = mean(amounts);
    const amountVariance = amounts.length > 1 ? coefficientOfVariation(amounts) : 0;

    // Flag as likely subscription
    const isLikelySubscription =
      consistencyScore > 0.85 &&
      frequency === "monthly" &&
      amountVariance < 0.05;

    // Use the most common category across this merchant's transactions
    const category = mostCommonCategory(sorted);

    patterns.push({
      merchant,
      category,
      frequency,
      avgAmount: round2(avgAmount),
      amountVariance: round2(amountVariance),
      consistencyScore: round2(consistencyScore),
      occurrences: sorted.length,
      firstSeen: sorted[0].date,
      lastSeen: sorted[sorted.length - 1].date,
      isLikelySubscription,
    });
  }

  // Sort by occurrences descending for readability
  patterns.sort((a, b) => b.occurrences - a.occurrences);

  return patterns;
}

// ── Helpers ───────────────────────────────────────────────────

function toEpochDay(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Use UTC to avoid timezone shifts
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return standardDeviation(values) / avg;
}

function classifyFrequency(
  medianInterval: number
): "weekly" | "biweekly" | "monthly" | "irregular" {
  if (medianInterval >= 5 && medianInterval <= 9) return "weekly";
  if (medianInterval >= 12 && medianInterval <= 18) return "biweekly";
  if (medianInterval >= 25 && medianInterval <= 35) return "monthly";
  return "irregular";
}

function computeConsistency(intervals: number[]): number {
  if (intervals.length === 0) return 0;
  const cv = coefficientOfVariation(intervals);

  if (cv < 0.15) return 0.9 + (0.15 - cv) / 0.15 * 0.1; // 0.9–1.0
  if (cv < 0.3) return 0.7 + (0.3 - cv) / 0.15 * 0.2;   // 0.7–0.9
  if (cv < 0.5) return 0.4 + (0.5 - cv) / 0.2 * 0.3;     // 0.4–0.7
  return Math.max(0, 0.4 - (cv - 0.5) * 0.4);              // below 0.4
}

function mostCommonCategory(txns: Transaction[]): TransactionCategory {
  const counts = new Map<TransactionCategory, number>();
  for (const t of txns) {
    counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  }
  let best: TransactionCategory = txns[0].category;
  let bestCount = 0;
  for (const [cat, count] of counts) {
    if (count > bestCount) {
      best = cat;
      bestCount = count;
    }
  }
  return best;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
