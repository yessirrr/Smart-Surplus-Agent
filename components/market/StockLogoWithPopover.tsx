"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { getStockInfo, getLocalStockData } from "@/lib/market/stocks";
import type { LocalStockData } from "@/lib/market/stocks";
import { AreaChart, Area, YAxis, XAxis, Tooltip } from "recharts";
import { CompanyLogo } from "@/components/market/CompanyLogo";

function tickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 42%)`;
}

type ActivePopoverListener = (activeId: string | null) => void;

const activePopoverListeners = new Set<ActivePopoverListener>();
let activePopoverId: string | null = null;
let popoverInstanceCounter = 0;

const HOVER_LEAVE_DELAY_MS = 80;
const POPOVER_OFFSET_PX = 4;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function createPopoverInstanceId(): string {
  popoverInstanceCounter += 1;
  return `stock-popover-${popoverInstanceCounter}`;
}

function getActivePopoverId(): string | null {
  return activePopoverId;
}

function setActivePopoverId(nextId: string | null) {
  if (activePopoverId === nextId) return;
  activePopoverId = nextId;
  for (const listener of activePopoverListeners) {
    listener(activePopoverId);
  }
}

function subscribeActivePopover(listener: ActivePopoverListener): () => void {
  activePopoverListeners.add(listener);
  return () => {
    activePopoverListeners.delete(listener);
  };
}

function formatMonthTick(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  if (!d) return "";
  return monthFormatter.format(d);
}

function formatTooltipDate(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  if (!d) return isoDate;
  return tooltipDateFormatter.format(d);
}

function parseIsoDate(isoDate: string): Date | null {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

interface StockLogoWithPopoverProps {
  merchant: string;
  size?: "sm" | "md";
}

export function StockLogoWithPopover({
  merchant,
  size = "md",
}: StockLogoWithPopoverProps) {
  const stock = getStockInfo(merchant);
  if (!stock) return null;

  return <StockLogoInner stock={stock} size={size} merchant={merchant} />;
}

function StockLogoInner({
  stock,
  size,
  merchant,
}: {
  stock: { ticker: string; companyName: string; exchange: string };
  size: "sm" | "md";
  merchant: string;
}) {
  const instanceIdRef = useRef<string | null>(null);
  if (instanceIdRef.current === null) {
    instanceIdRef.current = createPopoverInstanceId();
  }
  const instanceId = instanceIdRef.current;

  const [isActive, setIsActive] = useState<boolean>(
    () => getActivePopoverId() === instanceId
  );
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bg = tickerColor(stock.ticker);
  const liveData = getLocalStockData(stock.ticker);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearHideTimeout();
    setActivePopoverId(instanceId);
  }, [clearHideTimeout, instanceId]);

  const handleMouseLeave = useCallback(() => {
    clearHideTimeout();
    hideTimeout.current = setTimeout(() => {
      if (getActivePopoverId() === instanceId) {
        setActivePopoverId(null);
      }
      hideTimeout.current = null;
    }, HOVER_LEAVE_DELAY_MS);
  }, [clearHideTimeout, instanceId]);

  useEffect(() => {
    return subscribeActivePopover((nextId) => {
      setIsActive(nextId === instanceId);
    });
  }, [instanceId]);

  useEffect(() => {
    return () => {
      clearHideTimeout();
      if (getActivePopoverId() === instanceId) {
        setActivePopoverId(null);
      }
    };
  }, [clearHideTimeout, instanceId]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="shrink-0 cursor-default"
      >
        <CompanyLogo
          companyName={stock.companyName}
          merchantName={merchant}
          size={size}
          fallbackText={stock.ticker[0]}
          fallbackColor={bg}
        />
      </div>

      {isActive &&
        createPortal(
          <PopoverCard
            stock={stock}
            liveData={liveData}
            triggerRef={triggerRef}
            popoverRef={popoverRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />,
          document.body
        )}
    </>
  );
}

function PopoverCard({
  stock,
  liveData,
  triggerRef,
  popoverRef,
  onMouseEnter,
  onMouseLeave,
}: {
  stock: { ticker: string; companyName: string; exchange: string };
  liveData: LocalStockData | null;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 220;
    const popoverHeight = 180;

    let top = rect.top - popoverHeight - POPOVER_OFFSET_PX;
    let left = rect.left + POPOVER_OFFSET_PX;

    // Viewport boundary checks
    if (top < POPOVER_OFFSET_PX) {
      top = rect.bottom + POPOVER_OFFSET_PX; // flip below
    }
    if (left + popoverWidth > window.innerWidth - POPOVER_OFFSET_PX) {
      left = window.innerWidth - popoverWidth - POPOVER_OFFSET_PX;
    }
    if (left < POPOVER_OFFSET_PX) left = POPOVER_OFFSET_PX;

    setPos({ top, left });
  }, [triggerRef]);

  const isPositive = liveData ? liveData.changePercent >= 0 : true;
  const chartData =
    liveData?.prices.map((point) => ({ date: point.date, close: point.close })) ?? [];

  const yDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) {
      return [0, 1];
    }

    const values = chartData.map((point) => point.close);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      const pad = min === 0 ? 1 : Math.abs(min) * 0.02;
      return [min - pad, max + pad];
    }

    const spread = max - min;
    const pad = spread * 0.02;
    return [min - pad, max + pad];
  }, [chartData]);

  const tickDates = useMemo<string[]>(() => {
    const n = chartData.length;
    if (n === 0) return [];

    const indices = [0, Math.floor((n - 1) / 2), n - 1];
    const seen = new Set<string>();
    const ticks: string[] = [];

    for (const idx of indices) {
      const point = chartData[idx];
      if (!point) continue;
      if (!seen.has(point.date)) {
        seen.add(point.date);
        ticks.push(point.date);
      }
    }

    return ticks;
  }, [chartData]);

  return (
    <div
      ref={popoverRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[9999]"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="bg-white rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.14)] p-3 w-[220px] border border-[rgba(0,0,0,0.08)]">
        {/* Header - left-aligned with ticker on same row */}
        <div className="flex justify-between items-center">
          <p className="text-xs font-bold text-[rgb(50,48,47)] truncate">
            {stock.companyName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-medium text-[rgb(104,102,100)] bg-[rgb(242,242,242)] rounded px-1.5 py-0.5">
            {stock.ticker}
          </span>
          <span className="text-[10px] text-[rgb(104,102,100)]">
            {stock.exchange}
          </span>
        </div>

        {/* Price + Change */}
        {liveData ? (
          <>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-sm font-bold text-[rgb(50,48,47)] tabular-nums">
                ${liveData.latestClose.toFixed(2)}
              </span>
              <span
                className={`text-xs font-medium tabular-nums ${isPositive ? "text-[#0b8a3e]" : "text-[#cd1c13]"}`}
              >
                {isPositive ? "+" : ""}
                {liveData.changePercent.toFixed(2)}%
              </span>
            </div>

            {/* 6-month history chart */}
            {chartData.length > 0 && (
              <div className="mt-1 overflow-hidden">
                <AreaChart width={196} height={52} data={chartData}>
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
                  <YAxis hide domain={yDomain} />
                  <XAxis
                    dataKey="date"
                    ticks={tickDates}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "rgb(104,102,100)" }}
                    tickFormatter={formatMonthTick}
                    padding={{ left: 10, right: 10 }}
                    height={14}
                    dy={2}
                  />
                  <Tooltip
                    cursor={false}
                    content={<SparklineTooltip />}
                    allowEscapeViewBox={{ x: false, y: false }}
                    wrapperStyle={{ pointerEvents: "none" }}
                  />
                  <Area
                    type="linear"
                    dataKey="close"
                    stroke={isPositive ? "#0b8a3e" : "#cd1c13"}
                    strokeWidth={1.5}
                    fill={`url(#fill-${stock.ticker})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </div>
            )}
          </>
        ) : (
          <p className="text-[10px] text-[rgb(104,102,100)] mt-2">
            Market data unavailable
          </p>
        )}
      </div>
    </div>
  );
}

function SparklineTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: { date?: string; close?: number } }>;
}) {
  if (!props.active || !props.payload || props.payload.length === 0) {
    return null;
  }

  const point = props.payload[0]?.payload;
  if (!point || typeof point.close !== "number" || typeof point.date !== "string") {
    return null;
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 6,
        padding: "4px 6px",
      }}
    >
      <p style={{ fontSize: 9, color: "rgb(104,102,100)", lineHeight: 1.2 }}>
        {formatTooltipDate(point.date)}
      </p>
      <p style={{ fontSize: 10, color: "rgb(50,48,47)", fontWeight: 600, lineHeight: 1.2 }}>
        {currencyFormatter.format(point.close)}
      </p>
    </div>
  );
}
