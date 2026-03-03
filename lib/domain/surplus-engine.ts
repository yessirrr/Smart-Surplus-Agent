import type {
  Transaction,
  HabitCandidate,
  PaySchedule,
  PeriodSurplus,
  SurplusSummary,
  TransactionCategory,
} from "../types";

/** Categories treated as essential (non-negotiable) spending */
const ESSENTIAL_CATEGORIES = new Set<string>([
  "rent",
  "utilities",
  "internet",
  "phone",
  "insurance",
  "transit",
  "groceries",
]);

/**
 * Computes "true surplus" for each calendar month:
 *   surplus = income - essentialSpend - discretionarySpend
 *   potentialSurplus = surplus + habitSpend
 */
export function computeSurplus(
  transactions: Transaction[],
  habitCandidates: HabitCandidate[],
  // Intentionally unused: surplus is currently transaction-ledger based, not schedule-modeled.
  _paySchedule: PaySchedule
): SurplusSummary {
  if (transactions.length === 0) {
    return emptySummary();
  }

  // Build a set of all habit-linked transaction IDs for O(1) lookup
  const habitTxnIds = new Set<string>();
  for (const hc of habitCandidates) {
    for (const id of hc.transactionIds) {
      habitTxnIds.add(id);
    }
  }

  // Group transactions into calendar months
  const byMonth = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    const month = txn.date.slice(0, 7); // "YYYY-MM"
    const list = byMonth.get(month);
    if (list) {
      list.push(txn);
    } else {
      byMonth.set(month, [txn]);
    }
  }

  // Sort months chronologically
  const sortedMonths = [...byMonth.keys()].sort();

  // Compute per-period metrics
  const periods: PeriodSurplus[] = [];

  // Track per-category totals for the breakdown
  const categoryTotals = new Map<string, number>();
  const categoryMonthCounts = new Map<string, number>();

  for (const month of sortedMonths) {
    const txns = byMonth.get(month)!;

    // Parse month to start/end dates
    const [year, mon] = month.split("-").map(Number);
    const periodStart = month + "-01";
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const periodEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    let income = 0;
    let essentialSpend = 0;
    let discretionarySpend = 0;
    let habitSpend = 0;

    for (const txn of txns) {
      if (txn.amount > 0) {
        // Income / credit
        income += txn.amount;
      } else {
        const spend = Math.abs(txn.amount);
        const isEssential = ESSENTIAL_CATEGORIES.has(txn.category);

        if (isEssential) {
          essentialSpend += spend;
        } else {
          discretionarySpend += spend;
        }

        // Count habit spend (subset of discretionary or any spending)
        if (habitTxnIds.has(txn.id)) {
          habitSpend += spend;
        }

        // Accumulate category totals
        const cat = txn.category;
        categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + spend);
        if (!categoryMonthCounts.has(cat)) {
          categoryMonthCounts.set(cat, 0);
        }
      }
    }

    // Track distinct months per category (for this month)
    const catsThisMonth = new Set<string>();
    for (const txn of txns) {
      if (txn.amount < 0) catsThisMonth.add(txn.category);
    }
    for (const cat of catsThisMonth) {
      categoryMonthCounts.set(cat, (categoryMonthCounts.get(cat) ?? 0) + 1);
    }

    const surplus = income - essentialSpend - discretionarySpend;
    const potentialSurplus = income - essentialSpend - (discretionarySpend - habitSpend);

    periods.push({
      periodStart,
      periodEnd,
      income: round2(income),
      essentialSpend: round2(essentialSpend),
      discretionarySpend: round2(discretionarySpend),
      habitSpend: round2(habitSpend),
      surplus: round2(surplus),
      potentialSurplus: round2(potentialSurplus),
    });
  }

  // Calculate averages
  const totalPeriods = periods.length;
  const averageMonthlySurplus =
    totalPeriods > 0
      ? periods.reduce((s, p) => s + p.surplus, 0) / totalPeriods
      : 0;
  const averageMonthlyPotentialSurplus =
    totalPeriods > 0
      ? periods.reduce((s, p) => s + p.potentialSurplus, 0) / totalPeriods
      : 0;
  const totalHabitSpend = periods.reduce((s, p) => s + p.habitSpend, 0);

  // Determine surplus trend: compare last 3 months vs first 3 months
  const surplusTrend = computeTrend(periods);

  // Build category breakdown
  const totalMonths = sortedMonths.length || 1;
  const categoryBreakdown: SurplusSummary["categoryBreakdown"] = [];
  for (const [cat, total] of categoryTotals) {
    categoryBreakdown.push({
      category: cat as TransactionCategory,
      monthlyAverage: round2(total / totalMonths),
      isEssential: ESSENTIAL_CATEGORIES.has(cat),
    });
  }
  // Sort by monthly average descending
  categoryBreakdown.sort((a, b) => b.monthlyAverage - a.monthlyAverage);

  return {
    periods,
    averageMonthlySurplus: round2(averageMonthlySurplus),
    averageMonthlyPotentialSurplus: round2(averageMonthlyPotentialSurplus),
    totalHabitSpend: round2(totalHabitSpend),
    surplusTrend,
    categoryBreakdown,
  };
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function computeTrend(
  periods: PeriodSurplus[]
): "increasing" | "decreasing" | "stable" {
  if (periods.length < 6) return "stable";

  const first3Avg =
    (periods[0].surplus + periods[1].surplus + periods[2].surplus) / 3;
  const last3 = periods.slice(-3);
  const last3Avg =
    (last3[0].surplus + last3[1].surplus + last3[2].surplus) / 3;

  // Guard against division by zero when first3Avg is 0
  if (first3Avg === 0) {
    if (last3Avg > 0) return "increasing";
    if (last3Avg < 0) return "decreasing";
    return "stable";
  }

  const change = (last3Avg - first3Avg) / Math.abs(first3Avg);
  if (change > 0.1) return "increasing";
  if (change < -0.1) return "decreasing";
  return "stable";
}

function emptySummary(): SurplusSummary {
  return {
    periods: [],
    averageMonthlySurplus: 0,
    averageMonthlyPotentialSurplus: 0,
    totalHabitSpend: 0,
    surplusTrend: "stable",
    categoryBreakdown: [],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

