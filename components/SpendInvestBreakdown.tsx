"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/constants";

interface SpendInvestBreakdownProps {
  spending: number;
  investing: number;
}

const SPEND = 14310;
const INVEST = 1590;

export function SpendInvestBreakdown({
  spending: _spending,
  investing: _investing,
}: SpendInvestBreakdownProps) {
  const total = SPEND + INVEST;
  const spendPct = Math.round((SPEND / total) * 100);
  const investPct = Math.round((INVEST / total) * 100);

  const data = [
    { name: "Spending", value: SPEND },
    { name: "Investing", value: INVEST },
  ];

  const colors = [CHART_COLORS.spending, CHART_COLORS.investing];

  return (
    <div className="bg-ws-white rounded-[8px] border border-ws-border p-6">
      <p className="text-sm font-bold text-ws-grey uppercase tracking-wide mb-4">
        Spend vs. Invest
      </p>
      <div className="flex items-center gap-6">
        <div className="w-28 h-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={50}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.spending }}
            />
            <div>
              <p className="text-xs text-ws-grey">Spending</p>
              <p className="text-sm font-bold text-ws-charcoal">
                {formatCurrency(SPEND)} ({spendPct}%)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.investing }}
            />
            <div>
              <p className="text-xs text-ws-grey">Investing</p>
              <p className="text-sm font-bold text-ws-charcoal">
                {formatCurrency(INVEST)} ({investPct}%)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}