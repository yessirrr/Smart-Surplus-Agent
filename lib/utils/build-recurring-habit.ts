import type { RecurringPattern, HabitCandidate, Transaction } from "@/lib/types";

export function buildRecurringHabit(
  patterns: RecurringPattern[],
  transactions: Transaction[]
): HabitCandidate | null {
  const monthly = patterns.filter(
    (p) => p.frequency === "monthly" && p.isLikelySubscription
  );

  if (monthly.length === 0) return null;

  const merchants = monthly.map((p) => p.merchant);
  const merchantSet = new Set(merchants);

  const monthlySpend = monthly.reduce((sum, p) => sum + p.avgAmount, 0);
  const yearlyProjection = monthlySpend * 12;
  const totalSpentAllTime = monthly.reduce(
    (sum, p) => sum + p.avgAmount * p.occurrences,
    0
  );

  // Max months active derived from firstSeen/lastSeen across patterns
  const monthsActive = monthly.reduce((max, p) => {
    const first = new Date(p.firstSeen);
    const last = new Date(p.lastSeen);
    const months =
      (last.getFullYear() - first.getFullYear()) * 12 +
      (last.getMonth() - first.getMonth()) +
      1;
    return Math.max(max, months);
  }, 0);

  const confidence =
    monthly.reduce((sum, p) => sum + p.consistencyScore, 0) / monthly.length;

  // Find all matching transaction IDs
  const transactionIds = transactions
    .filter(
      (t) =>
        merchantSet.has(t.merchant) &&
        (t.category === "subscriptions" || monthly.some((p) => p.category === t.category && p.merchant === t.merchant))
    )
    .map((t) => t.id);

  return {
    id: "habit_recurring",
    name: "Monthly Subscriptions",
    category: "subscriptions",
    merchants,
    confidence,
    metrics: {
      monthlySpend,
      weeklyFrequency: 0.25,
      yearlyProjection,
      totalSpentAllTime,
      dayOfWeekPattern: {},
      monthsActive,
    },
    transactionIds,
    suggestedGoal: {
      action: "reduce",
      potentialMonthlySavings: monthlySpend * 0.5,
      potentialYearlySavings: monthlySpend * 6,
    },
  };
}
