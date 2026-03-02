"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "motion/react";
import transactions from "@/data/transactions.json";
import type { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants & baseline computation from real data
// ---------------------------------------------------------------------------

const COMMITMENT_DATE = "2025-04-01";
const BASELINE_WEEKS = 8;
const PLAN_RATE = 0.07;
const WEEKLY_RATE = PLAN_RATE / 52;
const AUTOPLAY_MS = 2800;

const allTxns = (transactions as Transaction[]).sort((a, b) =>
  a.date.localeCompare(b.date)
);

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// 8-week window before commitment
const baselineStart = addDays(COMMITMENT_DATE, -BASELINE_WEEKS * 7);
const baselineVapeTxns = allTxns.filter(
  (t) =>
    t.category === "vaping" &&
    t.date >= baselineStart &&
    t.date < COMMITMENT_DATE
);
const baselineTotalSpend = baselineVapeTxns.reduce(
  (sum, t) => sum + Math.abs(t.amount),
  0
);
const weeklyVapeSpend = Math.round((baselineTotalSpend / BASELINE_WEEKS) * 100) / 100;

// Pick a real vaping merchant for the slip beat
const slipMerchant =
  baselineVapeTxns.length > 0
    ? baselineVapeTxns[baselineVapeTxns.length - 1].merchant
    : "VapeKing";

// Representative context merchants from real data
const coffeeMerchants = [...new Set(allTxns.filter((t) => t.category === "coffee").map((t) => t.merchant))];
const groceryMerchants = [...new Set(allTxns.filter((t) => t.category === "groceries").map((t) => t.merchant))];

// ---------------------------------------------------------------------------
// Beat definitions (the 7-beat story)
// ---------------------------------------------------------------------------

type BeatStatus = "active" | "paused" | "recovered";

interface TransactionMoment {
  merchant: string;
  amount: number;
  category: string;
  isVaping: boolean;
}

interface Beat {
  id: number;
  weekLabel: string;
  headline: string;
  subline: string;
  status: BeatStatus;
  isClean: boolean;
  isSlip: boolean;
  isMilestone: boolean;
  streakLabel: string | null;
  moments: TransactionMoment[];
  investedThisBeat: number;
  heldThisBeat: number;
}

function buildBeats(): Beat[] {
  const beats: Beat[] = [];

  // Beat 0: Baseline
  beats.push({
    id: 0,
    weekLabel: "Before",
    headline: "Your baseline.",
    subline: `You spent ~${formatCurrency(weeklyVapeSpend)} per week on vaping.`,
    status: "active",
    isClean: false,
    isSlip: false,
    isMilestone: false,
    streakLabel: null,
    moments: [
      { merchant: coffeeMerchants[0] || "Starbucks", amount: 5.45, category: "coffee", isVaping: false },
      { merchant: slipMerchant, amount: weeklyVapeSpend, category: "vaping", isVaping: true },
    ],
    investedThisBeat: 0,
    heldThisBeat: 0,
  });

  // Beat 1: Week 1 clean
  beats.push({
    id: 1,
    weekLabel: "Week 1",
    headline: "Clean week.",
    subline: "No vaping detected. Money redirected.",
    status: "active",
    isClean: true,
    isSlip: false,
    isMilestone: false,
    streakLabel: null,
    moments: [
      { merchant: coffeeMerchants[1] || "Tim Hortons", amount: 4.85, category: "coffee", isVaping: false },
      { merchant: groceryMerchants[0] || "No Frills", amount: 47.22, category: "groceries", isVaping: false },
    ],
    investedThisBeat: weeklyVapeSpend,
    heldThisBeat: 0,
  });

  // Beat 2: Week 2 clean
  beats.push({
    id: 2,
    weekLabel: "Week 2",
    headline: "Building momentum.",
    subline: "Two weeks without vaping purchases.",
    status: "active",
    isClean: true,
    isSlip: false,
    isMilestone: false,
    streakLabel: "2-week streak",
    moments: [
      { merchant: groceryMerchants[1] || "Metro", amount: 63.10, category: "groceries", isVaping: false },
      { merchant: coffeeMerchants[0] || "Starbucks", amount: 5.90, category: "coffee", isVaping: false },
    ],
    investedThisBeat: weeklyVapeSpend,
    heldThisBeat: 0,
  });

  // Beat 3: Week 3 clean
  beats.push({
    id: 3,
    weekLabel: "Week 3",
    headline: "On a roll.",
    subline: "Portfolio is growing. Habit is fading.",
    status: "active",
    isClean: true,
    isSlip: false,
    isMilestone: false,
    streakLabel: "3-week streak",
    moments: [
      { merchant: coffeeMerchants[2] || "Second Cup", amount: 6.25, category: "coffee", isVaping: false },
      { merchant: groceryMerchants[2] || "Loblaws", amount: 55.80, category: "groceries", isVaping: false },
    ],
    investedThisBeat: weeklyVapeSpend,
    heldThisBeat: 0,
  });

  // Beat 4: Week 4 slip
  beats.push({
    id: 4,
    weekLabel: "Week 4",
    headline: "Slip detected.",
    subline: "One purchase flagged. Investment paused.",
    status: "paused",
    isClean: false,
    isSlip: true,
    isMilestone: false,
    streakLabel: null,
    moments: [
      { merchant: groceryMerchants[0] || "No Frills", amount: 38.45, category: "groceries", isVaping: false },
      { merchant: slipMerchant, amount: weeklyVapeSpend, category: "vaping", isVaping: true },
    ],
    investedThisBeat: 0,
    heldThisBeat: weeklyVapeSpend,
  });

  // Beat 5: Week 5 recovery
  beats.push({
    id: 5,
    weekLabel: "Week 5",
    headline: "Back on track.",
    subline: "Recovery detected. Investing resumed.",
    status: "recovered",
    isClean: true,
    isSlip: false,
    isMilestone: false,
    streakLabel: "Back on track",
    moments: [
      { merchant: coffeeMerchants[1] || "Tim Hortons", amount: 5.15, category: "coffee", isVaping: false },
      { merchant: groceryMerchants[1] || "Metro", amount: 52.33, category: "groceries", isVaping: false },
    ],
    investedThisBeat: weeklyVapeSpend,
    heldThisBeat: 0,
  });

  // Beat 6: Week 6 momentum + milestone
  beats.push({
    id: 6,
    weekLabel: "Week 6",
    headline: "Momentum.",
    subline: "Your portfolio just passed a milestone.",
    status: "active",
    isClean: true,
    isSlip: false,
    isMilestone: true,
    streakLabel: "2-week streak",
    moments: [
      { merchant: coffeeMerchants[0] || "Starbucks", amount: 5.45, category: "coffee", isVaping: false },
      { merchant: groceryMerchants[2] || "Loblaws", amount: 44.90, category: "groceries", isVaping: false },
    ],
    investedThisBeat: weeklyVapeSpend,
    heldThisBeat: 0,
  });

  return beats;
}

const BEATS = buildBeats();

// Compute running ledger for each beat
interface Ledger {
  investedTotal: number;
  heldTotal: number;
  portfolioValue: number;
}

function computeLedgers(): Ledger[] {
  const ledgers: Ledger[] = [];
  let investedTotal = 0;
  let heldTotal = 0;

  for (let i = 0; i < BEATS.length; i++) {
    const beat = BEATS[i];
    investedTotal += beat.investedThisBeat;
    heldTotal += beat.heldThisBeat;

    // Weeks invested = number of clean beats so far (excluding baseline)
    const weeksInvested = BEATS.slice(0, i + 1).filter(
      (b) => b.id > 0 && b.isClean
    ).length;

    const portfolioValue =
      investedTotal > 0
        ? investedTotal * (1 + WEEKLY_RATE * weeksInvested)
        : 0;

    ledgers.push({
      investedTotal: Math.round(investedTotal * 100) / 100,
      heldTotal: Math.round(heldTotal * 100) / 100,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
    });
  }
  return ledgers;
}

const LEDGERS = computeLedgers();

// ---------------------------------------------------------------------------
// Animated number component
// ---------------------------------------------------------------------------

function AnimatedNumber({
  value,
  className,
  prefix = "$",
}: {
  value: number;
  className?: string;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(value);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      {prefix}
      {display.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Particle burst for milestone celebration
// ---------------------------------------------------------------------------

function ParticleBurst() {
  const particles = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360;
      const distance = 60 + Math.random() * 80;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
        size: 3 + Math.random() * 4,
        delay: Math.random() * 0.2,
        color: i % 3 === 0 ? "#0b8a3e" : i % 3 === 1 ? "#32302f" : "#cd1c13",
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            left: "50%",
            top: "50%",
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{
            duration: 0.9,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flow visualization (money path)
// ---------------------------------------------------------------------------

function FlowPath({ isClean, isSlip }: { isClean: boolean; isSlip: boolean }) {
  const dotColor = isSlip ? "bg-ws-red" : isClean ? "bg-ws-green" : "bg-ws-grey";
  const lineColor = isSlip ? "bg-ws-red/30" : isClean ? "bg-ws-green/30" : "bg-ws-light-grey";
  const targetLabel = isSlip ? "Held" : isClean ? "Portfolio" : "";

  if (!isClean && !isSlip) return null;

  return (
    <div className="flex items-center gap-3 py-6 px-2">
      {/* Source */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-xs font-semibold text-ws-grey shrink-0"
      >
        Saved
      </motion.div>

      {/* Track */}
      <div className="flex-1 relative h-[2px]">
        <div className={`absolute inset-0 rounded-full ${lineColor}`} />
        <motion.div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${dotColor} shadow-sm`}
          initial={{ left: "0%" }}
          animate={{ left: isSlip ? "50%" : "100%" }}
          transition={{
            duration: 1.2,
            delay: 0.5,
            ease: isSlip ? [0.4, 0, 0.2, 1] : [0.25, 0.1, 0.25, 1],
          }}
        />
        {/* Gate marker at center */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-ws-border bg-ws-white" />
      </div>

      {/* Target */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.3 }}
        className={`text-xs font-semibold shrink-0 ${isSlip ? "text-ws-red" : "text-ws-green"}`}
      >
        {targetLabel}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function StatusChip({ status }: { status: BeatStatus }) {
  const config = {
    active: { bg: "bg-ws-green/10", text: "text-ws-green", dot: "bg-ws-green", label: "Active" },
    paused: { bg: "bg-ws-red/10", text: "text-ws-red", dot: "bg-ws-red", label: "Paused" },
    recovered: { bg: "bg-ws-green/10", text: "text-ws-green", dot: "bg-ws-green", label: "Recovered" },
  }[status];

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === "active" ? "pulse-green" : ""}`}
      />
      <span className={`text-[11px] font-semibold tracking-wide uppercase ${config.text}`}>
        {config.label}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Transaction moment pill
// ---------------------------------------------------------------------------

function MomentPill({
  moment,
  index,
}: {
  moment: TransactionMoment;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.15 + index * 0.08 }}
      className={`flex items-center justify-between px-4 py-2.5 rounded-[12px] ${
        moment.isVaping
          ? "bg-ws-red/5 ring-1 ring-ws-red/20"
          : "bg-ws-light-grey/60"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            moment.isVaping ? "bg-ws-red" : "bg-ws-charcoal/30"
          }`}
        />
        <span
          className={`text-sm ${
            moment.isVaping ? "font-semibold text-ws-red" : "text-ws-grey"
          }`}
        >
          {moment.merchant}
        </span>
      </div>
      <span
        className={`text-sm tabular-nums ${
          moment.isVaping ? "font-semibold text-ws-red" : "text-ws-grey"
        }`}
      >
        -{formatCurrency(moment.amount)}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scene card (the main visual for each beat)
// ---------------------------------------------------------------------------

function SceneCard({ beat, ledger }: { beat: Beat; ledger: Ledger }) {
  const isBaseline = beat.id === 0;
  const showFlow = !isBaseline;

  return (
    <motion.div
      key={beat.id}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative bg-ws-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden"
    >
      {/* Milestone particles */}
      {beat.isMilestone && <ParticleBurst />}

      <div className="px-8 pt-8 pb-6">
        {/* Top bar: Odysseus Active + status */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-ws-grey">
            Odysseus Active
          </span>
          <StatusChip status={beat.status} />
        </div>

        {/* Week label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xs font-semibold tracking-widest uppercase text-ws-grey/60 mb-2"
        >
          {beat.weekLabel}
        </motion.p>

        {/* BIG headline */}
        <motion.h1
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          className={`text-[2.5rem] leading-[1.1] font-bold tracking-tight mb-2 ${
            beat.isSlip ? "text-ws-red" : "text-ws-charcoal"
          }`}
        >
          {beat.headline}
        </motion.h1>

        {/* Subline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="text-sm text-ws-grey mb-6"
        >
          {beat.subline}
        </motion.p>

        {/* Streak badge */}
        {beat.streakLabel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 24 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ws-green/10 mb-6"
          >
            <span className="text-xs">&#x2713;</span>
            <span className="text-xs font-semibold text-ws-green">{beat.streakLabel}</span>
          </motion.div>
        )}

        {/* Transaction moments */}
        <div className="space-y-2 mb-4">
          {beat.moments.map((m, i) => (
            <MomentPill key={`${beat.id}-${m.merchant}-${i}`} moment={m} index={i} />
          ))}
        </div>

        {/* Flow visualization */}
        {showFlow && <FlowPath isClean={beat.isClean} isSlip={beat.isSlip} />}

        {/* Divider */}
        <div className="h-px bg-ws-border my-4" />

        {/* Bottom stats row: 3 big numbers */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ws-grey/60 mb-1">
              This week
            </p>
            <p
              className={`text-lg font-bold tabular-nums ${
                beat.isSlip ? "text-ws-red" : beat.isClean ? "text-ws-green" : "text-ws-charcoal"
              }`}
            >
              {beat.isClean ? "+" : beat.isSlip ? "" : ""}
              <AnimatedNumber value={isBaseline ? 0 : weeklyVapeSpend} prefix="$" />
            </p>
            {beat.isSlip && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-[10px] text-ws-red mt-0.5"
              >
                held
              </motion.p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ws-grey/60 mb-1">
              Invested
            </p>
            <p className="text-lg font-bold tabular-nums text-ws-charcoal">
              <AnimatedNumber value={ledger.investedTotal} prefix="$" />
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ws-grey/60 mb-1">
              Portfolio
            </p>
            <p className="text-lg font-bold tabular-nums text-ws-green">
              <AnimatedNumber value={ledger.portfolioValue} prefix="$" />
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Mini portfolio chart (below scene card)
// ---------------------------------------------------------------------------

function PortfolioShape({ currentBeat }: { currentBeat: number }) {
  const data = useMemo(() => {
    return LEDGERS.slice(0, currentBeat + 1).map((l, i) => ({
      beat: i,
      value: l.portfolioValue,
    }));
  }, [currentBeat]);

  if (data.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="mt-6"
    >
      <div className="h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(11,138,62,0.15)" />
                <stop offset="100%" stopColor="rgba(11,138,62,0)" />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0b8a3e"
              strokeWidth={2.5}
              fill="url(#portfolioGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlanPage() {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalBeats = BEATS.length;
  const atEnd = currentBeat >= totalBeats - 1;

  // Autoplay logic
  useEffect(() => {
    if (autoplay && !atEnd) {
      autoplayRef.current = setInterval(() => {
        setCurrentBeat((b) => {
          if (b >= totalBeats - 1) {
            setAutoplay(false);
            return b;
          }
          return b + 1;
        });
      }, AUTOPLAY_MS);
    }
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [autoplay, atEnd, totalBeats]);

  useEffect(() => {
    if (atEnd && autoplay) setAutoplay(false);
  }, [atEnd, autoplay]);

  const handleNext = useCallback(() => {
    if (!atEnd) {
      setCurrentBeat((b) => b + 1);
    }
  }, [atEnd]);

  const handleReplay = useCallback(() => {
    setCurrentBeat(0);
    setAutoplay(false);
  }, []);

  const beat = BEATS[currentBeat];
  const ledger = LEDGERS[currentBeat];

  // Progress dots
  const progressDots = useMemo(() => {
    return BEATS.map((b, i) => {
      const isActive = i === currentBeat;
      const isPast = i < currentBeat;
      const isFuture = i > currentBeat;
      return { id: b.id, isActive, isPast, isFuture, isSlip: b.isSlip };
    });
  }, [currentBeat]);

  return (
    <div className="min-h-screen bg-ws-off-white">
      {/* Subtle background texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(50,48,47) 0.5px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto max-w-[520px] px-5 pt-8 pb-12 min-h-screen flex flex-col">
        {/* Back link */}
        <Link
          href="/surplus"
          className="text-xs text-ws-grey hover:text-ws-charcoal transition-colors mb-8 self-start"
        >
          &larr; Back
        </Link>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          {progressDots.map((dot) => (
            <motion.div
              key={dot.id}
              animate={{
                scale: dot.isActive ? 1 : 0.75,
                opacity: dot.isFuture ? 0.25 : 1,
              }}
              transition={{ duration: 0.3 }}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                dot.isActive
                  ? dot.isSlip
                    ? "bg-ws-red"
                    : "bg-ws-charcoal"
                  : dot.isPast
                    ? dot.isSlip
                      ? "bg-ws-red/40"
                      : "bg-ws-green"
                    : "bg-ws-light-grey"
              }`}
            />
          ))}
        </div>

        {/* Scene card */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <SceneCard key={beat.id} beat={beat} ledger={ledger} />
          </AnimatePresence>

          {/* Portfolio shape chart */}
          <PortfolioShape currentBeat={currentBeat} />
        </div>

        {/* Controls */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {/* Main CTA */}
          {atEnd ? (
            <div className="flex items-center gap-3">
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleReplay}
                className="px-8 py-3 rounded-full bg-ws-charcoal text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Replay story
              </motion.button>
              <Link
                href="/"
                className="px-6 py-3 rounded-full border border-ws-border text-sm font-semibold text-ws-charcoal hover:bg-ws-light-grey transition-colors"
              >
                Dashboard
              </Link>
            </div>
          ) : (
            <motion.button
              key={`next-${currentBeat}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleNext}
              className="px-10 py-3.5 rounded-full bg-ws-charcoal text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_2px_12px_rgba(50,48,47,0.2)]"
            >
              {currentBeat === 0 ? "Begin commitment" : "Next week"} &rarr;
            </motion.button>
          )}

          {/* Autoplay toggle */}
          {!atEnd && (
            <button
              onClick={() => setAutoplay((a) => !a)}
              className={`text-xs transition-colors ${
                autoplay
                  ? "text-ws-charcoal font-semibold"
                  : "text-ws-grey hover:text-ws-charcoal"
              }`}
            >
              {autoplay ? "Autoplay on" : "Autoplay"}
            </button>
          )}

          {/* Ending message */}
          {atEnd && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-ws-grey text-center max-w-[280px]"
            >
              This is what Odysseus does. Behavior in, investment out.
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
