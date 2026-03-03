import type {
  PaySchedule,
  SpendingForecast,
  Transaction,
  TransactionCategory,
} from "@/lib/types";
import type { CashflowSnapshot } from "./cashflow-model";
import { computeDaysUntilNextPay } from "./cashflow-model";
import { mulberry32, quantile } from "./prng";

const DEFAULT_TRIALS = 500;
const DEFAULT_LOOKBACK_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const FIXED_OR_ESSENTIAL_CATEGORIES = new Set<TransactionCategory>([
  "rent",
  "utilities",
  "internet",
  "phone",
  "insurance",
  "groceries",
  "transit",
  "health",
  "pharmacy",
  "gym",
  "subscriptions",
]);

interface ForecastArgs {
  transactions: Transaction[];
  snapshot: CashflowSnapshot;
  paySchedule: PaySchedule;
  seed: number;
  trials?: number;
  lookbackDays?: number;
}

export function forecastVariableSpendUntilNextPay(
  args: ForecastArgs
): SpendingForecast {
  const trials = normalizeTrials(args.trials);
  const lookbackDays = normalizeLookbackDays(args.lookbackDays);
  const asOf = parseISODate(args.snapshot.snapshotDateISO);

  if (!asOf || trials <= 0 || lookbackDays <= 0) {
    return buildZeroForecast(0, args.seed, trials);
  }

  let daysUntilNextPay = 0;
  try {
    daysUntilNextPay = computeDaysUntilNextPay(asOf, args.paySchedule).daysUntilNextPay;
  } catch {
    return buildZeroForecast(0, args.seed, trials);
  }

  const windowDays = Math.max(0, Math.trunc(daysUntilNextPay));
  if (windowDays <= 0) {
    return buildZeroForecast(0, args.seed, trials);
  }

  const lookbackStart = addDaysUTC(asOf, -(lookbackDays - 1));

  const variableTransactions = args.transactions.filter((transaction) =>
    isVariableSpendTransaction(transaction, lookbackStart, asOf)
  );

  const dailyTotals = buildDailyTotals(variableTransactions, lookbackStart, asOf);
  if (dailyTotals.length === 0) {
    return buildZeroForecast(windowDays, args.seed, trials);
  }

  const rand = mulberry32(args.seed);
  const trialSums: number[] = [];

  for (let trial = 0; trial < trials; trial++) {
    let sum = 0;

    for (let day = 0; day < windowDays; day++) {
      const idx = Math.floor(rand() * dailyTotals.length);
      sum += dailyTotals[idx];
    }

    trialSums.push(round2(sum));
  }

  const sorted = [...trialSums].sort((a, b) => a - b);
  const mean =
    trialSums.length > 0
      ? round2(trialSums.reduce((acc, value) => acc + value, 0) / trialSums.length)
      : 0;

  const p50 = round2(quantile(sorted, 0.5));
  const p90 = round2(quantile(sorted, 0.9));

  return {
    windowDays,
    expectedWindowSpend: mean,
    p50WindowSpend: p50,
    p90WindowSpend: p90,
    seed: args.seed,
    trials,
    drivers: buildDrivers(variableTransactions, mean),
  };
}

function isVariableSpendTransaction(
  transaction: Transaction,
  start: Date,
  end: Date
): boolean {
  if (transaction.amount >= 0) {
    return false;
  }

  if (transaction.category === "income" || transaction.category === "transfer") {
    return false;
  }

  if (FIXED_OR_ESSENTIAL_CATEGORIES.has(transaction.category)) {
    return false;
  }

  const transactionDate = parseISODate(transaction.date);
  if (!transactionDate) {
    return false;
  }

  const ts = transactionDate.getTime();
  return ts >= start.getTime() && ts <= end.getTime();
}

function buildDailyTotals(
  transactions: Transaction[],
  start: Date,
  end: Date
): number[] {
  const byDate = new Map<string, number>();

  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += MS_PER_DAY) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    byDate.set(key, 0);
  }

  for (const transaction of transactions) {
    const dateKey = transaction.date;
    const current = byDate.get(dateKey) ?? 0;
    byDate.set(dateKey, current + Math.abs(transaction.amount));
  }

  return [...byDate.values()].map((value) => round2(value));
}

function buildDrivers(
  transactions: Transaction[],
  expectedWindowSpend: number
): Array<{ category: string; contribution: number }> | undefined {
  if (transactions.length === 0 || expectedWindowSpend <= 0) {
    return undefined;
  }

  const byCategory = new Map<string, number>();
  for (const transaction of transactions) {
    byCategory.set(
      transaction.category,
      (byCategory.get(transaction.category) ?? 0) + Math.abs(transaction.amount)
    );
  }

  const total = [...byCategory.values()].reduce((acc, value) => acc + value, 0);
  if (total <= 0) {
    return undefined;
  }

  return [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      contribution: round2((amount / total) * expectedWindowSpend),
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);
}

function normalizeTrials(trials?: number): number {
  if (!Number.isFinite(trials)) {
    return DEFAULT_TRIALS;
  }

  return Math.max(1, Math.trunc(trials ?? DEFAULT_TRIALS));
}

function normalizeLookbackDays(lookbackDays?: number): number {
  if (!Number.isFinite(lookbackDays)) {
    return DEFAULT_LOOKBACK_DAYS;
  }

  return Math.max(0, Math.trunc(lookbackDays ?? DEFAULT_LOOKBACK_DAYS));
}

function buildZeroForecast(windowDays: number, seed: number, trials: number): SpendingForecast {
  return {
    windowDays,
    expectedWindowSpend: 0,
    p50WindowSpend: 0,
    p90WindowSpend: 0,
    seed,
    trials,
  };
}

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function addDaysUTC(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
