"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TERMS_TRANSITION = {
  duration: 0.8,
  delay: 0.5,
  ease: [0, 0.71, 0.2, 1.01] as const,
};

interface AITermsModalProps {
  open: boolean;
  mode: "enable" | "view";
  onClose: () => void;
  onEnable?: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}

export function AITermsModal({
  open,
  mode,
  onClose,
  onEnable,
  triggerRef,
}: AITermsModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousOverflowRef = useRef("");
  const prevOpenRef = useRef(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  useEffect(() => {
    if (open && mode === "enable") {
      setHasAcceptedTerms(false);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const rafId = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      document.body.style.overflow = previousOverflowRef.current;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      triggerRef?.current?.focus();
    }

    prevOpenRef.current = open;
  }, [open, triggerRef]);

  function handleEnable() {
    if (!hasAcceptedTerms) {
      return;
    }

    onEnable?.();
    onClose();
  }

  const isReadOnly = mode === "view";

  const backdropEnterTransition = prefersReducedMotion
    ? { duration: 0.18, ease: "easeOut" as const }
    : TERMS_TRANSITION;

  const backdropExitTransition = prefersReducedMotion
    ? { duration: 0.12, ease: "easeOut" as const }
    : { ...TERMS_TRANSITION, delay: 0 };

  const panelEnterTransition = prefersReducedMotion
    ? { duration: 0.18, ease: "easeOut" as const }
    : TERMS_TRANSITION;

  const panelExitTransition = prefersReducedMotion
    ? { duration: 0.12, ease: "easeOut" as const }
    : { ...TERMS_TRANSITION, delay: 0 };

  const panelInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 12, scale: 0.98 };

  const panelAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 };

  const panelExit = prefersReducedMotion
    ? { opacity: 0, transition: panelExitTransition }
    : { opacity: 0, y: 8, scale: 0.99, transition: panelExitTransition };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: backdropEnterTransition }}
            exit={{ opacity: 0, transition: backdropExitTransition }}
            onClick={onClose}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="odysseus-ai-terms-title"
              tabIndex={-1}
              className="w-full max-w-[640px] max-h-[85vh] overflow-y-auto rounded-[14px] border border-ws-border bg-ws-white p-6 shadow-[0_22px_50px_rgba(0,0,0,0.24)]"
              initial={panelInitial}
              animate={{ ...panelAnimate, transition: panelEnterTransition }}
              exit={panelExit}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    id="odysseus-ai-terms-title"
                    className="text-sm font-semibold text-ws-charcoal tracking-[0.02em]"
                  >
                    Odysseus AI Terms
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-bold text-ws-charcoal hover:opacity-70 transition-opacity"
                >
                  Close
                </button>
              </div>

              <section className="mt-4 border-t border-ws-border/80 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ws-charcoal">
                  What Odysseus does
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1.5 marker:text-ws-grey">
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Analyzes spending patterns and recurring habits
                  </li>
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Groups habit-linked transactions to estimate savings scenarios
                  </li>
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Generates explanations and recommendations inside Odysseus
                  </li>
                </ul>
              </section>

              <section className="mt-4 border-t border-ws-border/80 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ws-charcoal">
                  What Odysseus does not do
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1.5 marker:text-ws-grey">
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Does not execute trades or move money
                  </li>
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Does not provide personalized financial advice as a registered advisor
                  </li>
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Does not guarantee outcomes or market returns
                  </li>
                </ul>
              </section>

              <section className="mt-4 border-t border-ws-border/80 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ws-charcoal">
                  Data &amp; privacy
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1.5 marker:text-ws-grey">
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Your data stays in this demo environment
                  </li>
                  <li className="text-sm text-ws-grey leading-relaxed">
                    Odysseus does not train models on your personal data
                  </li>
                  <li className="text-sm text-ws-grey leading-relaxed">
                    You can review and edit what transactions belong to a habit
                  </li>
                </ul>
              </section>

              <p className="mt-4 border-t border-ws-border/80 pt-4 text-xs text-ws-grey leading-relaxed">
                Projections are illustrative and may differ from real-world results.
              </p>

              {!isReadOnly ? (
                <div className="mt-4 space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAcceptedTerms}
                      onChange={(event) =>
                        setHasAcceptedTerms(event.currentTarget.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded accent-ws-charcoal"
                    />
                    <span className="text-sm text-ws-charcoal">
                      I agree to the terms
                    </span>
                  </label>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-xs font-bold text-ws-charcoal hover:opacity-70 transition-opacity"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleEnable}
                      disabled={!hasAcceptedTerms}
                      className="rounded-[72px] bg-ws-charcoal px-5 py-2.5 text-xs font-bold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
                    >
                      Enable Odysseus
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
