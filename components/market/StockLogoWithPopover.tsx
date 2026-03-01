"use client";

import { getStockInfo } from "@/lib/market/stocks";
import { AreaChart, Area } from "recharts";

function tickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 42%)`;
}

interface StockLogoWithPopoverProps {
  merchant: string;
  size?: number;
}

export function StockLogoWithPopover({
  merchant,
  size = 36,
}: StockLogoWithPopoverProps) {
  const stock = getStockInfo(merchant);
  if (!stock) return null;

  const bg = tickerColor(stock.ticker);
  const isPositive = stock.mockChange >= 0;
  const chartData = stock.mockHistory.map((v, i) => ({ i, v }));

  return (
    <div className="relative group/stock">
      <div
        className="rounded-[6px] flex items-center justify-center text-white font-bold shrink-0 cursor-default"
        style={{
          width: size,
          height: size,
          backgroundColor: bg,
          fontSize: size * 0.38,
        }}
      >
        {stock.ticker[0]}
      </div>

      {/* Popover */}
      <div className="absolute bottom-full mb-2 left-0 sm:left-0 right-auto opacity-0 pointer-events-none group-hover/stock:opacity-100 group-hover/stock:pointer-events-auto transition-opacity duration-150 delay-75 z-50">
        <div className="bg-ws-white rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.14)] p-3 w-[200px] border border-ws-border">
          <p className="text-xs font-bold text-ws-charcoal">
            {stock.companyName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-medium text-ws-grey bg-ws-light-grey rounded px-1.5 py-0.5">
              {stock.ticker}
            </span>
            <span className="text-[10px] text-ws-grey">{stock.exchange}</span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm font-bold text-ws-charcoal tabular-nums">
              ${stock.mockPrice.toFixed(2)}
            </span>
            <span
              className={`text-xs font-medium tabular-nums ${isPositive ? "text-ws-green" : "text-ws-red"}`}
            >
              {isPositive ? "+" : ""}
              {stock.mockChange.toFixed(2)}%
            </span>
          </div>

          <div className="mt-2">
            <AreaChart width={176} height={40} data={chartData}>
              <defs>
                <linearGradient
                  id={`fill-${stock.ticker}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={isPositive ? "#0b8a3e" : "#cd1c13"}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor={isPositive ? "#0b8a3e" : "#cd1c13"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={isPositive ? "#0b8a3e" : "#cd1c13"}
                strokeWidth={1.5}
                fill={`url(#fill-${stock.ticker})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </div>
        </div>
      </div>
    </div>
  );
}
