"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

export type TourStepId =
  | "welcome"
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
  | "workspace_check_impact";

export interface TourStep {
  id: TourStepId;
  target: string | null;          // CSS selector for spotlight
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right" | "center" | "top-right";
  // How this step advances
  advance: "button" | "dom_watch"; // button = user clicks Next/Done, dom_watch = auto via DOM
  watchFor?: string;               // selector to appear/be-disabled for dom_watch
  watchMode?: "appear" | "disabled" | "value"; // what to detect
  forced?: boolean;                // pulsing ring, no skip label
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Welcome to JobClawd 👋",
    content: "This is a quick guided tour — purely for demonstration. We'll use example data so nothing real is searched or submitted, no credits are spent, and nothing is saved to your account. It takes about a minute.",
    position: "center",
    advance: "button",
  },
  {
    id: "type_search",
    target: "[data-tour='search-input']",
    title: "Search for a job",
    content: "We've pre-filled \"Marketing Manager\" for you — feel free to change it. The tour will continue automatically.",
    position: "bottom",
    advance: "dom_watch",
    watchFor: "[data-tour='search-input']",
    watchMode: "value",
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
    content: "Click Search to find Marketing Manager roles across LinkedIn, Indeed, and jobsearch.az — all at once. For the demo, results load instantly.",
    position: "bottom",
    advance: "dom_watch",
    watchFor: "[data-tour='search-btn']",
    watchMode: "disabled",
    forced: true,
  },
  {
    id: "searching",
    target: "[data-tour='feed-filter']",
    title: "Searching 3 sources…",
    content: "In production, JobClawd scrapes all three sources in parallel — this normally takes 15–30 seconds. For this tour we're using demo results so you don't have to wait.",
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
    position: "right",
    advance: "dom_watch",
    watchFor: "[data-tour='vacancy-panel']",
    watchMode: "appear",
    forced: true,
  },
  {
    id: "vacancy_overview",
    target: "[data-tour='vacancy-overview-tab']",
    title: "Vacancy overview",
    content: "Full details for the Marketing Manager role at GrowthBridge — location, work mode, salary, and the complete job description. The match score card breaks down how well your profile aligns.",
    position: "left",
    advance: "button",
  },
  {
    id: "vacancy_improve",
    target: "[data-tour='vacancy-improve-tab']",
    title: "Improve your CV for this role",
    content: "Switch here to analyze your CV specifically against the Marketing Manager vacancy and get targeted AI suggestions.",
    position: "left",
    advance: "button",
  },
  {
    id: "cv_upload",
    target: "[data-tour='cv-selector-area']",
    title: "Select your CV",
    content: "Pick an existing CV from the dropdown or upload a new PDF/DOCX. Then click Analyze CV to score it against this Marketing Manager role.",
    position: "left",
    advance: "button",
  },
  {
    id: "cv_analyzed",
    target: "[data-tour='cv-selector-area']",
    title: "Analyzing against the role…",
    content: "Scoring your CV against the Marketing Manager requirements at GrowthBridge. Demo results appear instantly.",
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
    position: "left",
    advance: "dom_watch",
    watchFor: "[data-tour='workspace-cv-form']",
    watchMode: "appear",
    forced: true,
  },
  {
    id: "workspace_form",
    target: "[data-tour='workspace-cv-form']",
    title: "CV Editor",
    content: "Edit any section — personal info, work experience, skills, education — to better match the Marketing Manager role. Every change updates the ATS preview on the right in real time.",
    position: "top-right",
    advance: "button",
  },
  {
    id: "workspace_suggestions",
    target: "[data-tour='workspace-suggestions']",
    title: "AI Suggestions",
    content: "3 targeted suggestions for the Marketing Manager role at GrowthBridge: add HubSpot, quantify campaign results, and include OKR keywords. Accept individually or hit Apply All — each one bumps your match score.",
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
    content: "After accepting suggestions or editing sections, click Check Impact to re-score your CV against the Marketing Manager role — see exactly how many points you gained before downloading.",
    position: "bottom",
    advance: "button",
  },
];

interface TourContextValue {
  active: boolean;
  stepIndex: number;
  current: TourStep | null;
  tabHint: "overview" | "improve" | null;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  goTo: (idx: number) => void;
}

const TourContext = createContext<TourContextValue>({
  active: false, stepIndex: 0, current: null, tabHint: null,
  start: () => {}, next: () => {}, prev: () => {}, skip: () => {}, goTo: () => {},
});

export function TourProvider({ children, onFinish }: { children: ReactNode; onFinish: () => void }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const start = useCallback(() => { setStepIndex(0); setActive(true); }, []);

  const next = useCallback(() => {
    setStepIndex((s) => {
      const n = s + 1;
      if (n >= TOUR_STEPS.length) { setActive(false); onFinish(); return s; }
      return n;
    });
  }, [onFinish]);

  const prev = useCallback(() => setStepIndex((s) => Math.max(0, s - 1)), []);

  const goTo = useCallback((idx: number) => {
    setStepIndex(Math.max(0, Math.min(idx, TOUR_STEPS.length - 1)));
  }, []);

  const skip = useCallback(() => { setActive(false); onFinish(); }, [onFinish]);

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
      active, stepIndex, tabHint,
      current: active ? TOUR_STEPS[stepIndex] : null,
      start, next, prev, skip, goTo,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() { return useContext(TourContext); }
