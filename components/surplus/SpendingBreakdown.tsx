"use client";

import type { SurplusSummary, HabitCandidate } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface SpendingBreakdownProps {
  summary: SurplusSummary;
  habitCandidates: HabitCandidate[];
}

export function SpendingBreakdown({
  summary,
  habitCandidates,
}: SpendingBreakdownProps) {
  const categories = summary.categoryBreakdown
    .filter((c) => c.monthlyAverage > 0)
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

  const totalDiscretionary = categories
    .filter((c) => !c.isEssential)
    .reduce((s, c) => s + c.monthlyAverage, 0);

  const maxHabitSpend = habitCandidates.length > 0
    ? habitCandidates[0].metrics.monthlySpend
    : 1;

  return (
    <div>
      <h2 className="text-lg font-bold text-ws-charcoal">Follow the Money</h2>
      <p className="text-sm text-ws-grey mt-1">
        Your average monthly spending by category.
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Category breakdown */}
        <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
          <p className="text-xs font-bold text-ws-grey uppercase tracking-wide mb-3">
            All Categories
          </p>
          <div className="divide-y divide-ws-border max-h-[400px] overflow-y-auto">
            {categories.map((c) => (
              <div
                key={c.category}
                className="flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[c.category] ?? "#888888",
                    }}
                  />
                  <span className="text-sm text-ws-charcoal truncate">
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-bold text-ws-charcoal tabular-nums">
                    {formatCurrency(c.monthlyAverage)}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      c.isEssential
                        ? "text-ws-grey bg-ws-light-grey"
                        : "text-ws-red bg-red-50"
                    }`}
                  >
                    {c.isEssential ? "Essential" : "Discretionary"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Habit spend summary */}
        <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
          <p className="text-xs font-bold text-ws-grey uppercase tracking-wide mb-3">
            Your Top Habits
          </p>
          <div className="space-y-3">
            {habitCandidates.map((h) => {
              const pct =
                totalDiscretionary > 0
                  ? (h.metrics.monthlySpend / totalDiscretionary) * 100
                  : 0;
              const barWidth =
                (h.metrics.monthlySpend / maxHabitSpend) * 100;

              return (
                <div key={h.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ws-charcoal">{h.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-ws-red tabular-nums">
                        {formatCurrency(h.metrics.monthlySpend)}
                      </span>
                      <span className="text-[10px] text-ws-grey">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-ws-light-grey rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ws-red/70 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-ws-border">
            <p className="text-sm font-bold text-ws-charcoal">
              Total habit spend:{" "}
              <span className="text-ws-red">
                {formatCurrency(
                  habitCandidates.reduce(
                    (s, h) => s + h.metrics.totalSpentAllTime,
                    0
                  )
                )}
              </span>{" "}
              <span className="text-xs font-normal text-ws-grey">
                over 24 months
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
