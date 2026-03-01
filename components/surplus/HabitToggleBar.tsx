"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HabitCandidate } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface HabitToggleBarProps {
  habits: HabitCandidate[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

export function HabitToggleBar({
  habits,
  selectedIds,
  onToggle,
  onSelectAll,
}: HabitToggleBarProps) {
  const selectedHabits = habits.filter((h) => selectedIds.has(h.id));
  const totalMonthly = selectedHabits.reduce(
    (s, h) => s + h.metrics.monthlySpend,
    0
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    const handleResize = () => updateScrollState();

    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateScrollState, habits.length, selectedIds.size]);

  function scrollByAmount(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;

    const amount = direction === "right" ? 280 : -280;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="bg-ws-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-bold text-ws-grey uppercase tracking-wide">
          Toggle Habits
        </p>
        <button
          onClick={onSelectAll}
          disabled={selectedIds.size === habits.length}
          className="text-xs font-medium text-ws-grey hover:text-ws-charcoal transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          Select all
        </button>
      </div>

      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        >
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

        {canScrollLeft && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-14 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-ws-white to-transparent" />
            <button
              onClick={() => scrollByAmount("left")}
              className="hidden sm:flex pointer-events-auto absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 items-center justify-center rounded-full bg-ws-white text-ws-charcoal border border-ws-border shadow-[0_2px_8px_rgba(0,0,0,0.08)] opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Scroll habits left"
            >
              <ChevronLeft size={14} />
            </button>
          </>
        )}

        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-14 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-ws-white to-transparent" />
            <button
              onClick={() => scrollByAmount("right")}
              className="hidden sm:flex pointer-events-auto absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 items-center justify-center rounded-full bg-ws-white text-ws-charcoal border border-ws-border shadow-[0_2px_8px_rgba(0,0,0,0.08)] opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Scroll habits right"
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}
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