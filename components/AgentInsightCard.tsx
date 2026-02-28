import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { HabitCandidate } from "@/lib/types";

interface AgentInsightCardProps {
  habitCount: number;
  monthlySavings: number;
  topHabits: HabitCandidate[];
}

export function AgentInsightCard({
  habitCount,
  monthlySavings,
  topHabits,
}: AgentInsightCardProps) {
  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
      <p className="text-sm font-bold text-ws-charcoal">
        Odysseus detected {habitCount} spending habits
      </p>
      <p className="text-xs text-ws-grey mt-1">
        You could save up to {formatCurrency(monthlySavings)}/month by
        adjusting your habits
      </p>

      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        {topHabits.map((h) => (
          <span
            key={h.id}
            className="shrink-0 text-xs font-medium text-ws-charcoal bg-ws-light-grey rounded-[72px] px-3 py-1.5"
          >
            {h.name} &middot; {formatCurrency(h.metrics.monthlySpend)}/mo
          </span>
        ))}
      </div>

      <Link
        href="/habits"
        className="mt-4 block w-full text-center text-sm font-bold text-white bg-ws-charcoal rounded-[72px] py-3 hover:opacity-90 transition-opacity"
      >
        Set Up a Habit Goal
      </Link>
    </div>
  );
}
