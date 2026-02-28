export interface Transaction {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  category: TransactionCategory;
  type: "debit" | "credit";
  description: string;
}

export type TransactionCategory =
  | "rent"
  | "utilities"
  | "groceries"
  | "transit"
  | "subscriptions"
  | "income"
  | "transfer"
  | "coffee"
  | "coffee_shops"
  | "food_delivery"
  | "vaping"
  | "alcohol"
  | "personal_vices"
  | "impulse_shopping"
  | "shopping"
  | "dining_out"
  | "entertainment"
  | "rideshare"
  | "transportation"
  | "phone"
  | "internet"
  | "gym"
  | "insurance"
  | "health"
  | "personal_care"
  | "pharmacy"
  | "electronics"
  | "travel"
  | "fitness"
  | "home"
  | "gifts"
  | "other";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  province: string;
  city: string;
  income: {
    gross_annual: number;
    net_biweekly: number;
    pay_schedule: string;
    pay_day: string;
    employer: string;
  };
  accounts: {
    chequing_balance: number;
    savings_balance: number;
    tfsa_balance: number;
    rrsp_balance: number;
  };
  risk_tolerance: "low" | "medium" | "high";
  investment_horizon: string;
  goals: string[];
  created_at: string;
}

// ── Domain types ──────────────────────────────────────────────

export type HabitIntensity = "gentle" | "standard" | "strict";
export type Timeframe = { start: string; end?: string };
export type DecisionSource = "user" | "agent" | "system";

export interface HabitGoal {
  id: string;
  name: string;
  description?: string;
  timeframe: Timeframe;
  intensity: HabitIntensity;
  targetMode: "reduce" | "eliminate";
  targetValue?: { cadence: "week" | "month"; amount: number };
  createdAt: string;
}

export interface HabitRule {
  id: string;
  habitGoalId: string;
  matchers: Array<
    | { type: "category"; value: string }
    | { type: "merchant"; value: string }
    | { type: "keyword"; value: string }
  >;
  confidenceThreshold: number;
  createdBy: DecisionSource;
}

export interface HabitLabel {
  id: string;
  habitGoalId: string;
  transactionId: string;
  label: "habit_related" | "not_habit_related";
  labeledBy: DecisionSource;
  labeledAt: string;
}

export interface SurplusEvent {
  id: string;
  habitGoalId: string;
  periodStart: string;
  periodEnd: string;
  baselineSpend: number;
  actualSpend: number;
  computedSavings: number;
  explanation: string;
  createdAt: string;
}

export interface AllocationPlan {
  id: string;
  riskTolerance: "low" | "medium" | "high";
  horizon: "short" | "long";
  instrumentsAllowed: Array<"etf" | "mutual_fund">;
  split: Array<{ bucket: string; pct: number }>;
  requiresConfirmationEachTime: boolean;
}

// ── Recurring detection types ─────────────────────────────────

export interface RecurringPattern {
  merchant: string;
  category: TransactionCategory;
  frequency: "weekly" | "biweekly" | "monthly" | "irregular";
  avgAmount: number;
  amountVariance: number;
  consistencyScore: number;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  isLikelySubscription: boolean;
}

// ── Habit classifier types ────────────────────────────────────

export interface HabitCandidate {
  id: string;
  name: string;
  category: TransactionCategory;
  merchants: string[];
  confidence: number;
  metrics: {
    monthlySpend: number;
    weeklyFrequency: number;
    yearlyProjection: number;
    totalSpentAllTime: number;
    dayOfWeekPattern: Record<string, number>;
    monthsActive: number;
  };
  transactionIds: string[];
  suggestedGoal: {
    action: "reduce" | "eliminate";
    potentialMonthlySavings: number;
    potentialYearlySavings: number;
  };
}

// ── Surplus engine types ──────────────────────────────────────

export interface PaySchedule {
  frequency: "biweekly" | "monthly";
  dayOfWeek?: string;
  amount: number;
}

export interface PeriodSurplus {
  periodStart: string;
  periodEnd: string;
  income: number;
  essentialSpend: number;
  discretionarySpend: number;
  habitSpend: number;
  surplus: number;
  potentialSurplus: number;
}

export interface SurplusSummary {
  periods: PeriodSurplus[];
  averageMonthlySurplus: number;
  averageMonthlyPotentialSurplus: number;
  totalHabitSpend: number;
  surplusTrend: "increasing" | "decreasing" | "stable";
  categoryBreakdown: Array<{
    category: TransactionCategory;
    monthlyAverage: number;
    isEssential: boolean;
  }>;
}

// ── Orchestrator types ────────────────────────────────────────

export interface FullAnalysis {
  recurringPatterns: RecurringPattern[];
  habitCandidates: HabitCandidate[];
  surplusSummary: SurplusSummary;
  generatedAt: string;
}
