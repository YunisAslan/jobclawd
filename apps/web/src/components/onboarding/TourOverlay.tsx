"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Sparkles, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTour, TOUR_STEPS } from "@/contexts/TourContext";
import { cn } from "@/lib/utils";

const PAD = 8;
const TOOLTIP_W = 340;

interface Rect { top: number; left: number; width: number; height: number }

function useTargetRect(selector: string | null, active: boolean) {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!active || !selector) { setRect(null); return; }
    function measure() {
      const el = document.querySelector(selector!);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    const ro = new ResizeObserver(measure);
    const el = document.querySelector(selector);
    if (el) ro.observe(el);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.addEventListener("transitionend", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("transitionend", measure);
    };
  }, [selector, active]);

  return rect;
}

function tooltipPosition(
  rect: Rect | null,
  position: string,
  tooltipH: number,
): React.CSSProperties {
  if (!rect || position === "center") {
    return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }
  if (position === "top-right") {
    return { position: "fixed", top: 16, left: window.innerWidth - TOOLTIP_W - 16 };
  }
  const sp = { t: rect.top - PAD, l: rect.left - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const OFF = 16;

  if (position === "right") {
    const left = sp.l + sp.w + OFF;
    const top = Math.max(8, Math.min(sp.t + sp.h / 2 - tooltipH / 2, vh - tooltipH - 8));
    if (left + TOOLTIP_W < vw - 8) return { position: "fixed", top, left };
    return { position: "fixed", top, left: sp.l - TOOLTIP_W - OFF };
  }
  if (position === "left") {
    const left = sp.l - TOOLTIP_W - OFF;
    const top = Math.max(8, Math.min(sp.t + sp.h / 2 - tooltipH / 2, vh - tooltipH - 8));
    if (left > 8) return { position: "fixed", top, left };
    // Not enough room on the left — center the tooltip instead of going off-screen right
    return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }
  if (position === "bottom") {
    const left = Math.max(8, Math.min(sp.l + sp.w / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8));
    const top = sp.t + sp.h + OFF;
    if (top + tooltipH < vh - 8) return { position: "fixed", top, left };
    return { position: "fixed", top: sp.t - tooltipH - OFF, left };
  }
  // top
  const left = Math.max(8, Math.min(sp.l + sp.w / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8));
  const top = sp.t - tooltipH - OFF;
  if (top > 8) return { position: "fixed", top, left };
  return { position: "fixed", top: sp.t + sp.h + OFF, left };
}

// Number of visible tour steps (excludes mode_choice from the progress counter)
const VISIBLE_STEPS = TOUR_STEPS.length - 1;

export default function TourOverlay() {
  const { active, stepIndex, current, next: ctxNext, prev: ctxPrev, skip, goTo: ctxGoTo, demoMode, chooseDemoMode } = useTour();
  const router = useRouter();
  const rect = useTargetRect(active && current ? current.target : null, active);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipH, setTooltipH] = useState(200);

  // True when the user navigated *back* into the current step — disables auto-advance
  const enteredViaBack = useRef(false);

  const next = useCallback(() => {
    enteredViaBack.current = false;
    ctxNext();
  }, [ctxNext]);

  const prev = useCallback(() => {
    enteredViaBack.current = true;

    // Back from click_job: skip the invisible "searching" step → go to hit_search
    if (current?.id === "click_job") {
      ctxGoTo(TOUR_STEPS.findIndex((s) => s.id === "hit_search"));
      return;
    }

    // Back from vacancy_overview: close the vacancy panel first
    if (current?.id === "vacancy_overview") {
      (document.querySelector("[data-tour='close-vacancy-panel']") as HTMLElement | null)?.click();
      ctxPrev();
      return;
    }

    // Back from workspace_form: close the CV editor dialog
    if (current?.id === "workspace_form") {
      (document.querySelector("[data-slot='dialog-close']") as HTMLElement | null)?.click();
      ctxPrev();
      return;
    }

    ctxPrev();
  }, [ctxPrev, ctxGoTo, current?.id]);

  useLayoutEffect(() => {
    if (tooltipRef.current) {
      setTooltipH(tooltipRef.current.getBoundingClientRect().height);
    }
  });

  // ── DOM watchers ─────────────────────────────────────────────────────────

  // TYPE_SEARCH: in demo mode auto-fill "Marketing Manager" — no auto-advance, user clicks Next
  useEffect(() => {
    if (!active || current?.id !== "type_search" || !demoMode) return;
    const t = setTimeout(() => {
      const el = document.querySelector("[data-tour='search-input']") as HTMLInputElement | null;
      if (!el || el.value.trim().length >= 2) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      nativeSetter?.call(el, "Marketing Manager");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, 350);
    return () => clearTimeout(t);
  }, [active, current?.id, demoMode]);

  // SEARCHING: advance when first job card appears
  useEffect(() => {
    if (!active || current?.id !== "searching") return;
    let called = false;
    const iv = setInterval(() => {
      if (called || enteredViaBack.current) return;
      if (document.querySelector("[data-tour='first-job-card']")) { called = true; next(); }
    }, 400);
    return () => clearInterval(iv);
  }, [active, current?.id, next]);

  // CLICK_JOB: advance when vacancy panel tabs are mounted (panel is open)
  useEffect(() => {
    if (!active || current?.id !== "click_job") return;
    let called = false;
    const iv = setInterval(() => {
      if (called || enteredViaBack.current) return;
      if (document.querySelector("[data-tour='vacancy-overview-tab']")) { called = true; next(); }
    }, 300);
    return () => clearInterval(iv);
  }, [active, current?.id, next]);

  // CV_ANALYZED: advance when edit-cv-btn appears (analysis finished)
  useEffect(() => {
    if (!active || current?.id !== "cv_analyzed") return;
    let called = false;
    const iv = setInterval(() => {
      if (called || enteredViaBack.current) return;
      if (document.querySelector("[data-tour='edit-cv-btn']")) { called = true; next(); }
    }, 400);
    return () => clearInterval(iv);
  }, [active, current?.id, next]);

  // CV_EDIT: advance when CV workspace form mounts (editor opened).
  // Also listens for a click on the physical Edit CV button so the tour advances
  // even if the user clicks the panel button instead of the tour's Next button.
  useEffect(() => {
    if (!active || current?.id !== "cv_edit") return;
    let called = false;

    const editBtn = document.querySelector("[data-tour='edit-cv-btn']");
    const handleEditClick = () => { enteredViaBack.current = false; };
    editBtn?.addEventListener("click", handleEditClick);

    const iv = setInterval(() => {
      if (called || enteredViaBack.current) return;
      if (document.querySelector("[data-tour='workspace-cv-form']")) { called = true; next(); }
    }, 400);

    return () => {
      clearInterval(iv);
      editBtn?.removeEventListener("click", handleEditClick);
    };
  }, [active, current?.id, next]);

  // WORKSPACE_SUGGESTIONS: auto-trigger "Generate suggestions" on step entry if not yet loaded
  useEffect(() => {
    if (!active || current?.id !== "workspace_suggestions") return;
    const t = setTimeout(() => {
      const btn = document.querySelector("[data-tour='generate-suggestions-btn']") as HTMLElement | null;
      btn?.click();
    }, 200);
    return () => clearTimeout(t);
  }, [active, current?.id]);

  // WORKSPACE_ATS: auto-open the ATS panel if it isn't already open
  useEffect(() => {
    if (!active || current?.id !== "workspace_ats") return;
    if (!document.querySelector("[data-tour='workspace-ats-panel']")) {
      const btn = document.querySelector("[data-tour='workspace-ats-btn']") as HTMLElement | null;
      btn?.click();
    }
  }, [active, current?.id]);

  // WORKSPACE_CHECK_IMPACT: auto-click Check Impact so the result modal shows on entry
  useEffect(() => {
    if (!active || current?.id !== "workspace_check_impact") return;
    const t = setTimeout(() => {
      const btn = document.querySelector("[data-tour='workspace-check-impact-btn']") as HTMLElement | null;
      btn?.click();
    }, 200);
    return () => clearTimeout(t);
  }, [active, current?.id]);

  if (!active || !current) return null;

  // While search is running, hide the overlay entirely so the user can watch
  // results stream in normally. The DOM watcher will call next() when they appear.
  if (current.id === "searching") return null;

  // ── Mode choice screen ───────────────────────────────────────────────────

  if (current.id === "mode_choice") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
        <div className="w-full max-w-125 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

          <div className="h-0.5 bg-muted" />

          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-bold text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              How would you like to take this tour?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4">

            {/* Demo option */}
            <button
              type="button"
              onClick={() => chooseDemoMode(true)}
              className="cursor-pointer group flex flex-col gap-3 rounded-xl border-2 border-border hover:border-primary/60 bg-muted/20 hover:bg-primary/5 p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Sparkles className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Demo tour</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pre-filled example data
                </p>
              </div>
              <ul className="space-y-1 mt-auto">
                {[
                  "Nothing saved to your account",
                  "No credits used",
                  "~1 minute, risk-free",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-0.75 size-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Start demo →
              </div>
            </button>

            {/* Real data option */}
            <button
              type="button"
              onClick={() => chooseDemoMode(false)}
              className="cursor-pointer group flex flex-col gap-3 rounded-xl border-2 border-border hover:border-primary/60 bg-muted/20 hover:bg-primary/5 p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Database className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">My own data</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your real CV & job searches
                </p>
              </div>
              <ul className="space-y-1 mt-auto">
                {[
                  "Results saved to your account",
                  "Uses 1 search credit",
                  "See your actual match scores",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-0.75 size-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Use my data →
              </div>
            </button>

          </div>

          <div className="flex justify-center pb-5">
            <button
              type="button"
              onClick={skip}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 transition-colors"
            >
              Skip tour
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Tour complete screen ─────────────────────────────────────────────────

  if (current.id === "tour_complete") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-0.5 bg-primary" />
          <div className="px-6 pt-7 pb-6 flex flex-col items-center text-center gap-4">
            <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="size-7 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">{current.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">{current.content}</p>
            </div>
            <div className="flex flex-col gap-2 w-full pt-1">
              <Button
                className="w-full gap-2"
                onClick={() => { skip(); router.push("/dashboard"); }}
              >
                Go to Dashboard <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={skip}
              >
                Stay here
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Regular tour steps ───────────────────────────────────────────────────

  const isCenter = !current.target || current.position === "center";
  const sp = rect
    ? { t: rect.top - PAD, l: rect.left - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 }
    : null;

  const tipStyle = tooltipPosition(rect, current.position, tooltipH);

  // stepIndex 0 = mode_choice (not shown here), so visible progress starts at index 1
  const visibleIndex = stepIndex - 1;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        {isCenter || !sp ? (
          <div className="absolute inset-0 bg-black/40" />
        ) : (
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect x={sp.l} y={sp.t} width={sp.w} height={sp.h} rx="10" fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.48)" mask="url(#tour-mask)" />
          </svg>
        )}
      </div>

      {/* Spotlight ring — z-[60] so it appears above Radix Sheet (z-50) */}
      {!isCenter && sp && (
        <div
          className="fixed rounded-xl pointer-events-none"
          style={{
            zIndex: 60,
            top: sp.t, left: sp.l, width: sp.w, height: sp.h,
            boxShadow: "0 0 0 2px var(--primary)",
            transition: "top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease",
          }}
        />
      )}

      {/* Tooltip card — z-[70] so it's always above Sheet overlay (z-50) */}
      <div
        ref={tooltipRef}
        className="fixed pointer-events-auto"
        style={{ ...tipStyle, width: TOOLTIP_W, transition: "top 0.3s ease, left 0.3s ease", zIndex: 70 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">

          {/* Progress bar — counts visible steps only (excludes mode_choice) */}
          <div className="h-0.5 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((visibleIndex + 1) / VISIBLE_STEPS) * 100}%` }}
            />
          </div>

          <div className="px-5 py-4 space-y-3">

            {/* Title + skip */}
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground leading-snug">{current.title}</p>
              <Button
                type="button"
                variant="ghost"
                onClick={skip}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground shrink-0 mt-px underline underline-offset-2 h-auto p-0"
              >
                Skip tour
              </Button>
            </div>

            {/* Body */}
            <p className="text-xs text-muted-foreground leading-relaxed">{current.content}</p>

            {/* Navigation row */}
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              {/* Back — always present, invisible on first visible step */}
              <Button
                type="button"
                variant="ghost"
                onClick={prev}
                className={cn(
                  "text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 h-auto p-0",
                  false,
                )}
              >
                <ArrowLeft className="size-3" /> Back
              </Button>

              {/* Right side — every step has an explicit action */}
              {current.id === "workspace_suggestions" ? (
                // Apply all pending suggestions, then advance
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => {
                    (document.querySelector("[data-tour='apply-all-btn']") as HTMLElement | null)?.click();
                    next();
                  }}
                >
                  Next <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : current.id === "type_search" && demoMode ? (
                // Demo: re-fill "Marketing Manager" in case the user cleared it, then advance
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => {
                    const el = document.querySelector("[data-tour='search-input']") as HTMLInputElement | null;
                    if (el) {
                      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                      nativeSetter?.call(el, "Marketing Manager");
                      el.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                    next();
                  }}
                >
                  Next <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : current.id === "cv_analyzed" ? (
                // Async wait — show spinner until analysis finishes
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Analyzing…
                </div>
              ) : current.id === "hit_search" ? (
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => {
                    (document.querySelector("[data-tour='search-btn']") as HTMLElement | null)?.click();
                    next();
                  }}
                >
                  Next <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : current.id === "cv_upload" ? (
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => {
                    (document.querySelector("[data-tour='analyze-cv-btn']") as HTMLElement | null)?.click();
                    next();
                  }}
                >
                  Next <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : current.id === "click_job" ? (
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => {
                    enteredViaBack.current = false;
                    if (document.querySelector("[data-tour='vacancy-overview-tab']")) {
                      next();
                    } else {
                      (document.querySelector("[data-tour='view-details-btn']") as HTMLElement | null)?.click();
                    }
                  }}
                >
                  Next <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : current.id === "cv_edit" ? (
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => {
                    enteredViaBack.current = false;
                    if (document.querySelector("[data-tour='workspace-cv-form']")) {
                      next();
                    } else {
                      (document.querySelector("[data-tour='edit-cv-btn']") as HTMLElement | null)?.click();
                    }
                  }}
                >
                  Next <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={next} className="h-7 text-xs px-3">
                  {isLast ? "Done ✓" : <>Next <ArrowRight className="size-3 ml-1" /></>}
                </Button>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
