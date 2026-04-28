"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

export const TOUR_SEEN_KEY = "jc_tour_seen";
export const hasTourBeenSeen = () => typeof window !== "undefined" && !!localStorage.getItem(TOUR_SEEN_KEY);
export const markTourSeen = () => { if (typeof window !== "undefined") localStorage.setItem(TOUR_SEEN_KEY, "1"); };
export const clearTourSeen = () => { if (typeof window !== "undefined") localStorage.removeItem(TOUR_SEEN_KEY); };

export type TourStepId =
  | "mode_choice"
  | "type_search"
  | "fill_profile"
  | "hit_search"
  | "searching"
  | "click_job"
  | "vacancy_overview"
  | "vacancy_improve"
  | "cv_upload"
  | "cv_analyzed"
  | "cv_edit"
  | "workspace_form"
  | "workspace_ats"
  | "workspace_suggestions"
  | "workspace_check_impact"
  | "tour_complete";

export interface TourStep {
  id: TourStepId;
  target: string | null;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right" | "center" | "top-right";
  advance: "button" | "dom_watch";
  watchFor?: string;
  watchMode?: "appear" | "disabled" | "value";
  forced?: boolean;
  // Optional overrides shown when the user chose real-data mode
  realTitle?: string;
  realContent?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "mode_choice",
    target: null,
    title: "Welcome to JobClawd 👋",
    content: "Choose how you'd like to take this tour.",
    position: "center",
    advance: "button",
  },
  {
    id: "type_search",
    target: "[data-tour='search-input']",
    title: "Search for a job",
    content: "We've pre-filled \"Marketing Manager\" for you — feel free to change it to anything you like. Click Next when you're ready.",
    realContent: "Type the job title you're looking for, then click Next.",
    position: "bottom",
    advance: "button",
  },
  {
    id: "fill_profile",
    target: "[data-tour='fill-profile-btn']",
    title: "Fill from your profile",
    content: "In real use, this button pre-fills the query and all filters — job title, location, experience level — straight from your saved profile. No need to type anything manually.",
    position: "bottom",
    advance: "button",
  },
  {
    id: "hit_search",
    target: "[data-tour='search-btn']",
    title: "Run the search",
    content: "Click Next to search Marketing Manager roles across LinkedIn, Indeed, and jobsearch.az — all at once. For the demo, results load instantly.",
    realContent: "Click Next to search for matching roles across LinkedIn, Indeed, and jobsearch.az. This will use 1 search credit.",
    position: "bottom",
    advance: "button",
  },
  {
    id: "searching",
    target: "[data-tour='feed-filter']",
    title: "Searching 3 sources…",
    content: "In production, JobClawd scrapes all three sources in parallel — this normally takes 15–30 seconds. For this tour we're using demo results so you don't have to wait.",
    realContent: "JobClawd is scraping LinkedIn, Indeed, and jobsearch.az in parallel — this typically takes 15–30 seconds.",
    position: "bottom",
    advance: "dom_watch",
    watchFor: "[data-tour='first-job-card']",
    watchMode: "appear",
  },
  {
    id: "click_job",
    target: "[data-tour='first-job-card']",
    title: "Marketing Manager at GrowthBridge",
    content: "This card shows the role, company, salary range, and your AI match score. Click View Details to open the full vacancy — description, requirements, and match breakdown.",
    realTitle: "Open a vacancy",
    realContent: "Each card shows the role, company, salary range, and your AI match score. Click View Details to open the full vacancy — description, requirements, and match breakdown.",
    position: "right",
    advance: "dom_watch",
    watchFor: "[data-tour='vacancy-panel']",
    watchMode: "appear",
  },
  {
    id: "vacancy_overview",
    target: "[data-tour='vacancy-overview-tab']",
    title: "Vacancy overview",
    content: "Full details for the role — location, work mode, salary, and the complete job description. The match score card breaks down how well your profile aligns.",
    position: "left",
    advance: "button",
  },
  {
    id: "vacancy_improve",
    target: "[data-tour='vacancy-improve-tab']",
    title: "Improve your CV for this role",
    content: "Switch here to analyze your CV specifically against this vacancy and get targeted AI suggestions.",
    position: "left",
    advance: "button",
  },
  {
    id: "cv_upload",
    target: "[data-tour='cv-selector-area']",
    title: "Select your CV",
    content: "Pick an existing CV from the dropdown or upload a new PDF/DOCX. Then click Analyze CV to score it against this role.",
    position: "left",
    advance: "button",
  },
  {
    id: "cv_analyzed",
    target: "[data-tour='cv-selector-area']",
    title: "Analyzing against the role…",
    content: "Scoring your CV against the role requirements. Demo results appear instantly.",
    realContent: "Scoring your CV against the role requirements. This may take a few seconds.",
    position: "left",
    advance: "dom_watch",
    watchFor: "[data-tour='edit-cv-btn']",
    watchMode: "appear",
  },
  {
    id: "cv_edit",
    target: "[data-tour='edit-cv-btn']",
    title: "CV scored — 74% match",
    content: "Your CV has been matched against the Marketing Manager role. Click Edit CV (or Next) to open the editor — update sections, review AI suggestions, and check your improved score.",
    realTitle: "Your CV is scored",
    realContent: "Your CV has been matched against this role. Click Edit CV (or Next) to open the editor — update sections, review AI suggestions, and check your improved score.",
    position: "left",
    advance: "dom_watch",
    watchFor: "[data-tour='workspace-cv-form']",
    watchMode: "appear",
  },
  {
    id: "workspace_form",
    target: "[data-tour='workspace-cv-form']",
    title: "CV Editor",
    content: "Edit any section — personal info, work experience, skills, education — to better match the role. Every change updates the ATS preview on the right in real time.",
    position: "top-right",
    advance: "button",
  },
  {
    id: "workspace_suggestions",
    target: "[data-tour='workspace-suggestions']",
    title: "AI Suggestions",
    content: "6 targeted suggestions for the Marketing Manager role at GrowthBridge: rewrite your summary, add HubSpot, quantify results, add paid media impact, OKR keywords, and cross-functional leadership. Accept individually or hit Apply All.",
    realContent: "Targeted AI suggestions for this specific role. Accept them individually or hit Apply All — each one bumps your match score.",
    position: "right",
    advance: "button",
  },
  {
    id: "workspace_ats",
    target: "[data-tour='workspace-ats-panel']",
    title: "ATS Preview",
    content: "This is exactly how an Applicant Tracking System reads your CV. Hover any section to magnify it. Updates live as you type or accept suggestions.",
    position: "left",
    advance: "button",
  },
  {
    id: "workspace_check_impact",
    target: "[data-tour='workspace-check-impact-btn']",
    title: "Check Impact",
    content: "After accepting suggestions or editing sections, click Check Impact to re-score your CV against the role — see exactly how many points you gained before downloading.",
    position: "bottom",
    advance: "button",
  },
  {
    id: "tour_complete",
    target: null,
    title: "You're all set! 🎉",
    content: "You now know how JobClawd works — search roles, score your CV, apply AI suggestions, and measure your improvement. Your data is yours: save CVs, track applications, and come back anytime to refine further.",
    realContent: "Your results are saved. Come back anytime to refine your CV further, track applications, and run new searches across all three job boards.",
    position: "center",
    advance: "button",
  },
];

interface TourContextValue {
  active: boolean;
  stepIndex: number;
  current: TourStep | null;
  tabHint: "overview" | "improve" | null;
  demoMode: boolean;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  goTo: (idx: number) => void;
  chooseDemoMode: (demo: boolean) => void;
}

const TourContext = createContext<TourContextValue>({
  active: false, stepIndex: 0, current: null, tabHint: null, demoMode: true,
  start: () => {}, next: () => {}, prev: () => {}, skip: () => {}, goTo: () => {}, chooseDemoMode: () => {},
});

export function TourProvider({ children, onFinish }: { children: ReactNode; onFinish?: (demoMode: boolean) => void }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [demoMode, setDemoMode] = useState(true);

  const start = useCallback(() => { setStepIndex(0); setDemoMode(true); setActive(true); }, []);

  const next = useCallback(() => {
    setStepIndex((s) => {
      const n = s + 1;
      if (n >= TOUR_STEPS.length) { setActive(false); onFinish?.(demoMode); return s; }
      return n;
    });
  }, [onFinish, demoMode]);

  const prev = useCallback(() => setStepIndex((s) => Math.max(0, s - 1)), []);

  const goTo = useCallback((idx: number) => {
    setStepIndex(Math.max(0, Math.min(idx, TOUR_STEPS.length - 1)));
  }, []);

  const skip = useCallback(() => { setActive(false); onFinish?.(demoMode); }, [onFinish, demoMode]);

  const chooseDemoMode = useCallback((demo: boolean) => {
    setDemoMode(demo);
    setStepIndex((s) => s + 1);
  }, []);

  // Resolve the current step with mode-specific text overrides
  const resolvedCurrent = useMemo((): TourStep | null => {
    if (!active) return null;
    const step = TOUR_STEPS[stepIndex];
    if (!step) return null;
    if (demoMode) return step;
    return {
      ...step,
      title: step.realTitle ?? step.title,
      content: step.realContent ?? step.content,
    };
  }, [active, stepIndex, demoMode]);

  const tabHint = useMemo((): "overview" | "improve" | null => {
    if (!active) return null;
    const id = TOUR_STEPS[stepIndex]?.id;
    if (id === "vacancy_overview") return "overview";
    if (
      id === "vacancy_improve" || id === "cv_upload" ||
      id === "cv_analyzed" || id === "cv_edit" ||
      id === "workspace_form" || id === "workspace_ats" ||
      id === "workspace_suggestions" || id === "workspace_check_impact"
    ) return "improve";
    return null;
  }, [active, stepIndex]);

  return (
    <TourContext.Provider value={{
      active, stepIndex, tabHint, demoMode,
      current: resolvedCurrent,
      start, next, prev, skip, goTo, chooseDemoMode,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() { return useContext(TourContext); }
