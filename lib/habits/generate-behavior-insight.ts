import type { TransactionCategory } from "@/lib/types";

export interface GoalBehaviorData {
  habitName: string;
  category: TransactionCategory;
  monthlySpend: number;
  weeklyFrequency: number;
  avgCostPerOccurrence?: number;
}

export interface BehaviorInsightText {
  body: string;
  kicker: string;
}

const UNIT_BY_CATEGORY: Partial<Record<TransactionCategory, string>> = {
  food_delivery: "order",
  coffee: "coffee",
  coffee_shops: "coffee",
  vaping: "purchase",
  alcohol: "drink",
  dining_out: "meal out",
  impulse_shopping: "purchase",
  shopping: "purchase",
  rideshare: "ride",
  transportation: "trip",
  entertainment: "purchase",
  electronics: "purchase",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatCount(value: number): string {
  if (value < 1.5) return "1";
  return String(Math.round(value));
}

function pluralize(unit: string, count: number): string {
  if (count <= 1.5) return unit;
  if (unit.endsWith("s")) return unit;
  return `${unit}s`;
}

function formatCadence(weeklyFrequency: number, baseUnit: string): string {
  if (weeklyFrequency >= 1) {
    const count = Number(formatCount(weeklyFrequency));
    return `${formatCount(weeklyFrequency)} ${pluralize(baseUnit, count)} per week`;
  }

  if (weeklyFrequency >= 0.4) {
    const everyTwoWeeks = weeklyFrequency * 2;
    const count = Number(formatCount(everyTwoWeeks));
    return `${formatCount(everyTwoWeeks)} ${pluralize(baseUnit, count)} every two weeks`;
  }

  const monthly = Math.max(1, Math.round(weeklyFrequency * 4.33));
  return `${monthly} ${pluralize(baseUnit, monthly)} per month`;
}

function getKicker(reductionPercent: number): string {
  if (reductionPercent === 25) {
    return "Start light, stay consistent, and let the savings compound quietly.";
  }
  if (reductionPercent === 50) {
    return "This is the balanced path: strong progress without burnout.";
  }
  if (reductionPercent === 75) {
    return "This is a serious reset that creates meaningful monthly room fast.";
  }
  return "Full commitment removes the habit loop and turns that cash into momentum.";
}

export function generateBehaviorInsight(
  goalData: GoalBehaviorData,
  selectedReduction: number
): BehaviorInsightText {
  const unit = UNIT_BY_CATEGORY[goalData.category] ?? "purchase";
  const currentWeekly = Math.max(goalData.weeklyFrequency, 0);
  const reductionRatio = Math.min(Math.max(selectedReduction / 100, 0), 1);
  const targetWeekly = currentWeekly * (1 - reductionRatio);
  const monthlySavings = goalData.monthlySpend * reductionRatio;

  const avgCost =
    typeof goalData.avgCostPerOccurrence === "number"
      ? goalData.avgCostPerOccurrence
      : currentWeekly > 0
        ? goalData.monthlySpend / (currentWeekly * 4.33)
        : 0;

  const currentCadence = formatCadence(currentWeekly, unit);
  const targetCadence =
    selectedReduction === 100 ? "none" : formatCadence(targetWeekly, unit);

  const cadenceSentence =
    selectedReduction === 100
      ? `Choosing elimination means taking that to zero and redirecting around ${currencyFormatter.format(monthlySavings)} each month.`
      : `At ${selectedReduction}% reduction, your target cadence becomes about ${targetCadence}, which frees roughly ${currencyFormatter.format(monthlySavings)} each month.`;

  const avgCostSentence =
    avgCost > 0
      ? `At roughly ${currencyFormatter.format(avgCost)} per ${unit}, this is a high-leverage habit to adjust.`
      : "This is a high-leverage habit to adjust because it appears consistently over time.";

  return {
    body: `Right now, ${goalData.habitName.toLowerCase()} lands around ${currentCadence}. ${cadenceSentence} ${avgCostSentence}`,
    kicker: getKicker(selectedReduction),
  };
}


