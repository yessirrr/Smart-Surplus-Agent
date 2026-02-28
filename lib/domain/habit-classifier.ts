import type {
  Transaction,
  RecurringPattern,
  HabitCandidate,
  TransactionCategory,
} from "../types";

/**
 * All data categories considered discretionary / habit-forming.
 * Transactions outside these categories are not analyzed.
 */
const DISCRETIONARY_CATEGORIES = new Set<string>([
  "vaping",
  "alcohol",
  "personal_vices",
  "food_delivery",
  "coffee",
  "coffee_shops",
  "dining_out",
  "entertainment",
  "impulse_shopping",
  "shopping",
  "electronics",
  "rideshare",
  "transportation",
]);

/** Categories that suggest "eliminate" rather than "reduce" */
const VICE_CATEGORIES = new Set<string>(["vaping", "personal_vices"]);

/** Readable names for each category cluster */
const HABIT_NAMES: Record<string, string> = {
  vaping: "Vaping",
  alcohol: "Alcohol",
  personal_vices: "Personal Vices",
  food_delivery: "Food Delivery",
  coffee: "Daily Coffee",
  coffee_shops: "Daily Coffee",
  dining_out: "Dining Out",
  entertainment: "Entertainment",
  impulse_shopping: "Impulse Shopping",
  shopping: "Shopping",
  electronics: "Electronics",
  rideshare: "Rideshare",
  transportation: "Transportation",
};

/** Category confidence weight factor (weight: 0.25 in the final score) */
const CATEGORY_CONFIDENCE: Record<string, number> = {
  vaping: 1.0,
  alcohol: 0.9,
  personal_vices: 1.0,
  food_delivery: 0.9,
  coffee: 0.85,
  coffee_shops: 0.85,
  dining_out: 0.7,
  entertainment: 0.7,
  impulse_shopping: 0.7,
  shopping: 0.7,
  electronics: 0.7,
  rideshare: 0.7,
  transportation: 0.7,
};

/**
 * Identifies habit-linked spending by clustering discretionary transactions
 * by category and analyzing frequency/consistency patterns.
 */
export function classifyHabits(
  transactions: Transaction[],
  _recurringPatterns: RecurringPattern[]
): HabitCandidate[] {
  if (transactions.length === 0) return [];

  // Filter to discretionary debit transactions only
  const discretionary = transactions.filter(
    (t) => t.amount < 0 && DISCRETIONARY_CATEGORIES.has(t.category)
  );

  // Cluster by category
  const clusters = new Map<string, Transaction[]>();
  for (const txn of discretionary) {
    const list = clusters.get(txn.category);
    if (list) {
      list.push(txn);
    } else {
      clusters.set(txn.category, [txn]);
    }
  }

  // Determine date range of the full dataset for monthly averages
  const allDates = transactions.map((t) => t.date).sort();
  const totalMonths = Math.max(countDistinctMonths(allDates), 1);

  const candidates: HabitCandidate[] = [];
  let idCounter = 1;

  for (const [category, txns] of clusters) {
    // Skip clusters below 4 transactions per month average
    const avgPerMonth = txns.length / totalMonths;
    if (avgPerMonth < 4) continue;

    // Unique merchants in this cluster
    const merchants = [...new Set(txns.map((t) => t.merchant))].sort();

    // Total and monthly spend (absolute values)
    const totalSpent = txns.reduce((s, t) => s + Math.abs(t.amount), 0);
    const monthlySpend = totalSpent / totalMonths;
    const weeksPerMonth = 52 / 12;
    const weeklyFrequency = txns.length / (totalMonths * weeksPerMonth);

    // Day-of-week distribution
    const dayOfWeekPattern = computeDayOfWeekPattern(txns);

    // Months active
    const monthsActive = countDistinctMonths(txns.map((t) => t.date));

    // Yearly projection
    const yearlyProjection = monthlySpend * 12;

    // Confidence score
    const confidence = computeConfidence(txns, totalMonths, monthsActive, category);

    // Suggested goal
    const isVice = VICE_CATEGORIES.has(category);
    const action: "reduce" | "eliminate" = isVice ? "eliminate" : "reduce";
    const potentialMonthlySavings =
      action === "eliminate" ? monthlySpend : monthlySpend * 0.5;

    candidates.push({
      id: `habit_${String(idCounter++).padStart(3, "0")}`,
      name: HABIT_NAMES[category] ?? category,
      category: category as TransactionCategory,
      merchants,
      confidence: round2(confidence),
      metrics: {
        monthlySpend: round2(monthlySpend),
        weeklyFrequency: round2(weeklyFrequency),
        yearlyProjection: round2(yearlyProjection),
        totalSpentAllTime: round2(totalSpent),
        dayOfWeekPattern,
        monthsActive,
      },
      transactionIds: txns.map((t) => t.id),
      suggestedGoal: {
        action,
        potentialMonthlySavings: round2(potentialMonthlySavings),
        potentialYearlySavings: round2(potentialMonthlySavings * 12),
      },
    });
  }

  // Sort by monthly spend descending (most impactful first)
  candidates.sort((a, b) => b.metrics.monthlySpend - a.metrics.monthlySpend);

  return candidates;
}

// ── Helpers ───────────────────────────────────────────────────

function countDistinctMonths(dates: string[]): number {
  const months = new Set<string>();
  for (const d of dates) {
    months.add(d.slice(0, 7));
  }
  return months.size;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeDayOfWeekPattern(txns: Transaction[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of DAY_NAMES) counts[name] = 0;

  for (const t of txns) {
    const [y, m, d] = t.date.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    counts[DAY_NAMES[dow]]++;
  }
  return counts;
}

function computeConfidence(
  txns: Transaction[],
  totalMonths: number,
  monthsActive: number,
  category: string
): number {
  // 1. Frequency regularity (weight 0.3)
  //    How stable is the per-month transaction count?
  const monthlyCounts = new Map<string, number>();
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    monthlyCounts.set(m, (monthlyCounts.get(m) ?? 0) + 1);
  }
  const countsArr = [...monthlyCounts.values()];
  const countCV = countsArr.length > 1 ? coefficientOfVariation(countsArr) : 0.5;
  const frequencyScore = Math.max(0, Math.min(1, 1 - countCV));

  // 2. Duration (weight 0.25) — present across 12+ months → higher
  const durationScore = Math.min(1, monthsActive / 12);

  // 3. Amount consistency (weight 0.2)
  const amounts = txns.map((t) => Math.abs(t.amount));
  const amountCV = amounts.length > 1 ? coefficientOfVariation(amounts) : 0.5;
  const amountScore = Math.max(0, Math.min(1, 1 - amountCV));

  // 4. Category weight (0.25)
  const catWeight = CATEGORY_CONFIDENCE[category] ?? 0.7;

  return (
    frequencyScore * 0.3 +
    durationScore * 0.25 +
    amountScore * 0.2 +
    catWeight * 0.25
  );
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
