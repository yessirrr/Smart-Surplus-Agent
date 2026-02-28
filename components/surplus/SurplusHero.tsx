"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SurplusSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface SurplusHeroProps {
  summary: SurplusSummary;
}

export function SurplusHero({ summary }: SurplusHeroProps) {
  const actual = summary.averageMonthlySurplus;
  const potential = summary.averageMonthlyPotentialSurplus;
  const delta = potential - actual;

  // 5-year compound growth: FV = PMT × ((1 + r/12)^(n*12) - 1) / (r/12)
  const r = 0.07;
  const n = 5;
  const fv =
    delta * ((Math.pow(1 + r / 12, n * 12) - 1) / (r / 12));

  // Chart data from periods
  const chartData = summary.periods.map((p) => {
    const label = formatMonthLabel(p.periodStart);
    return {
      month: label,
      actual: Math.round(p.surplus),
      potential: Math.round(p.potentialSurplus),
    };
  });

  return (
    <div>
      {/* Hero card */}
      <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
          <div>
            <p className="text-xs text-ws-grey uppercase tracking-wide">
              Current Monthly Surplus
            </p>
            <p className="text-2xl font-bold text-ws-charcoal mt-1">
              {formatCurrency(actual)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ws-grey uppercase tracking-wide">
              Potential Monthly Surplus
            </p>
            <p className="text-3xl font-bold text-ws-green mt-1">
              {formatCurrency(potential)}
            </p>
          </div>
        </div>

        <p className="text-sm text-ws-charcoal mt-4">
          That&apos;s{" "}
          <span className="font-bold text-ws-green">
            {formatCurrency(delta)}/month
          </span>{" "}
          you could redirect into investments.
        </p>
        <p className="text-xs text-ws-grey mt-2">
          Over 5 years at 7% average return, that could grow to{" "}
          <span className="font-bold text-ws-charcoal">
            ~{formatCurrency(fv)}
          </span>
        </p>
      </div>

      {/* Trend chart */}
      <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6 mt-4">
        <p className="text-xs text-ws-grey uppercase tracking-wide mb-4">
          Monthly Surplus — 24 Months
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="fillPotential" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0b8a3e" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#0b8a3e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(50,48,47)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="rgb(50,48,47)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "rgb(104,102,100)" }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgb(104,102,100)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                formatter={((value: number | undefined, name: string | undefined) => [
                  formatCurrency(value ?? 0),
                  name === "potential" ? "Potential" : "Actual",
                ]) as never}
              />
              <Area
                type="monotone"
                dataKey="potential"
                stroke="#0b8a3e"
                strokeWidth={2}
                strokeDasharray="6 3"
                fill="url(#fillPotential)"
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="rgb(50,48,47)"
                strokeWidth={2}
                fill="url(#fillActual)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-ws-charcoal rounded" />
            <span className="text-[10px] text-ws-grey">Actual surplus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-ws-green rounded border-dashed" style={{ borderTop: "2px dashed #0b8a3e", height: 0 }} />
            <span className="text-[10px] text-ws-grey">Potential surplus</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = String(year).slice(2);
  return `${months[month - 1]} '${shortYear}`;
}
