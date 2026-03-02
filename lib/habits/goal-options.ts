import type { HabitCandidate, HabitIntensity, TransactionCategory } from "@/lib/types";

const DEFAULT_REDUCTION_PERCENTS = [25, 50, 75] as const;

const REDUCTION_PERCENTS_BY_CATEGORY: Partial<
  Record<TransactionCategory, readonly number[]>
> = {
  vaping: [25, 50, 100],
  personal_vices: [25, 50, 100],
  food_delivery: [25, 50, 100],
  alcohol: [25, 50, 100],
  coffee: [25, 50, 100],
  coffee_shops: [25, 50, 100],
};

const INTENSITY_ORDER: HabitIntensity[] = ["gentle", "standard", "strict"];

const DESCRIPTION_BY_PERCENT: Record<number, string> = {
  25: "Small changes, sustainable pace",
  50: "Meaningful reduction, balanced approach",
  75: "Maximum commitment, maximum savings",
  100: "Full commitment, maximum savings",
};

export interface GoalReductionOption {
  value: HabitIntensity;
  reductionPercent: number;
  title: string;
  description: string;
  recommended?: boolean;
}

export function getReductionPercentsForHabit(
  habit: Pick<HabitCandidate, "category">
): readonly number[] {
  return REDUCTION_PERCENTS_BY_CATEGORY[habit.category] ?? DEFAULT_REDUCTION_PERCENTS;
}

export function getReductionPercentForIntensity(
  habit: Pick<HabitCandidate, "category">,
  intensity: HabitIntensity
): number {
  const percents = getReductionPercentsForHabit(habit);
  const index = INTENSITY_ORDER.indexOf(intensity);
  return percents[index] ?? percents[percents.length - 1];
}

export function buildGoalOptions(
  habit: Pick<HabitCandidate, "category">
): GoalReductionOption[] {
  const percents = getReductionPercentsForHabit(habit);

  return INTENSITY_ORDER.map((value, index) => {
    const reductionPercent = percents[index] ?? percents[percents.length - 1];
    return {
      value,
      reductionPercent,
      title:
        reductionPercent === 100
          ? "Eliminate completely"
          : `Reduce by ${reductionPercent}%`,
      description:
        DESCRIPTION_BY_PERCENT[reductionPercent] ??
        "Meaningful reduction with stronger consistency",
      recommended: value === "standard",
    };
  });
}
