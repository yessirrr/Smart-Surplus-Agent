"use client";

import type { HabitCandidate } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface HabitToggleBarProps {
  habits: HabitCandidate[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function HabitToggleBar({
  habits,
  selectedIds,
  onToggle,
}: HabitToggleBarProps) {
  const selectedHabits = habits.filter((h) => selectedIds.has(h.id));
  const totalMonthly = selectedHabits.reduce(
    (s, h) => s + h.metrics.monthlySpend,
    0
  );

  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
      <p className="text-xs font-bold text-ws-grey uppercase tracking-wide mb-3">
        Toggle Habits
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {habits.map((h) => {
          const active = selectedIds.has(h.id);
          return (
            <button
              key={h.id}
              onClick={() => onToggle(h.id)}
              className={`shrink-0 text-xs font-medium rounded-[72px] px-3 py-1.5 transition-colors ${
                active
                  ? "bg-ws-charcoal text-white"
                  : "bg-ws-light-grey text-ws-grey"
              }`}
            >
              {h.name} &middot; {formatCurrency(h.metrics.monthlySpend)}/mo
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ws-grey mt-3">
        {selectedIds.size} habit{selectedIds.size !== 1 ? "s" : ""} selected
        &middot;{" "}
        <span className="font-bold text-ws-charcoal">
          {formatCurrency(totalMonthly)}/month
        </span>{" "}
        &middot; {formatCurrency(totalMonthly * 12)}/year in potential savings
      </p>
    </div>
  );
}
