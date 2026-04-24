"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
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

export default function TourOverlay() {
  const { active, stepIndex, current, next: ctxNext, prev: ctxPrev, skip } = useTour();
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
    ctxPrev();
  }, [ctxPrev]);

  useLayoutEffect(() => {
    if (tooltipRef.current) {
      setTooltipH(tooltipRef.current.getBoundingClientRect().height);
    }
  });

  // ── DOM watchers ─────────────────────────────────────────────────────────

  // TYPE_SEARCH: advance when input has ≥2 chars — only if entered going forward
  useEffect(() => {
    if (!active || current?.id !== "type_search") return;
    let called = false;
    const iv = setInterval(() => {
      if (called || enteredViaBack.current) return;
      const el = document.querySelector("[data-tour='search-input']") as HTMLInputElement | null;
      if (el && el.value.trim().length >= 2) { called = true; next(); }
    }, 300);
    return () => clearInterval(iv);
  }, [active, current?.id, next]);

  // HIT_SEARCH: advance when search button becomes disabled (live) or results appear (cached)
  useEffect(() => {
    if (!active || current?.id !== "hit_search") return;
    let called = false;

    const iv = setInterval(() => {
      if (called || enteredViaBack.current) return;
      if (document.querySelector("[data-tour='first-job-card']")) { called = true; next(); }
    }, 300);

    const btn = document.querySelector("[data-tour='search-btn']");
    const mo = btn ? new MutationObserver(() => {
      if (called || enteredViaBack.current) return;
      if (btn.hasAttribute("disabled")) { called = true; next(); }
    }) : null;
    mo?.observe(btn!, { attributes: true, attributeFilter: ["disabled"] });

    return () => { clearInterval(iv); mo?.disconnect(); };
  }, [active, current?.id, next]);

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

  if (!active || !current) return null;

  // While search is running, hide the overlay entirely so the user can watch
  // results stream in normally. The DOM watcher will call next() when they appear.
  if (current.id === "searching") return null;

  const isCenter = !current.target || current.position === "center";
  const sp = rect
    ? { t: rect.top - PAD, l: rect.left - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 }
    : null;

  const tipStyle = tooltipPosition(rect, current.position, tooltipH);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isForced = current.forced;
  const showNextBtn = current.advance === "button";

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
          className={cn("fixed rounded-xl pointer-events-none", isForced && "animate-pulse")}
          style={{
            zIndex: 60,
            top: sp.t, left: sp.l, width: sp.w, height: sp.h,
            boxShadow: `0 0 0 2px var(--primary)${isForced ? ", 0 0 16px 2px color-mix(in srgb, var(--primary) 40%, transparent)" : ""}`,
            transition: "top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease",
          }}
        />
      )}

      {/* Backdrop click-through for auto steps */}
      {!isForced && !showNextBtn && (
        <div className="fixed inset-0 cursor-pointer" style={{ zIndex: 55 }} onClick={next} />
      )}

      {/* Tooltip card — z-[70] so it's always above Sheet overlay (z-50) */}
      <div
        ref={tooltipRef}
        className="fixed pointer-events-auto"
        style={{ ...tipStyle, width: TOOLTIP_W, transition: "top 0.3s ease, left 0.3s ease", zIndex: 70 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">

          {/* Progress bar */}
          <div className="h-0.5 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
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

            {/* Forced hint */}
            {isForced && (
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
                {current.id === "type_search" ? "Type something to continue…" : "Click to continue…"}
              </p>
            )}

            {/* Navigation row */}
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              {/* Back — always present, invisible on step 0 */}
              <Button
                type="button"
                variant="ghost"
                onClick={prev}
                className={cn(
                  "text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 h-auto p-0",
                  isFirst && "invisible",
                )}
              >
                <ArrowLeft className="size-3" /> Back
              </Button>

              {/* Right side */}
              {showNextBtn ? (
                current.id === "cv_upload" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      const btn = document.querySelector("[data-tour='analyze-cv-btn']") as HTMLElement | null;
                      btn?.click();
                      next();
                    }}
                    className="h-7 text-xs px-3"
                  >
                    Next <ArrowRight className="size-3 ml-1" />
                  </Button>
                ) : (
                <Button
                  size="sm"
                  onClick={next}
                  className="h-7 text-xs px-3"
                >
                  {isLast ? "Done ✓" : <>Next <ArrowRight className="size-3 ml-1" /></>}
                </Button>
                )
              ) : current.id === "click_job" ? (
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => {
                    // Allow the DOM watcher to fire even if we backed into this step
                    enteredViaBack.current = false;
                    // If panel already open (e.g. backed in), advance directly
                    if (document.querySelector("[data-tour='vacancy-overview-tab']")) {
                      next();
                    } else {
                      const btn = document.querySelector("[data-tour='view-details-btn']") as HTMLElement | null;
                      btn?.click();
                    }
                  }}
                >
                  Next <ArrowRight className="size-3 ml-1" />
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">
                  {isForced ? "Action required" : "Auto-advancing…"}
                </p>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
