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
  position: "top" | "bottom" | "left" | "right" | "center";
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
    content: "Let's walk through the platform together. It takes about a minute and you'll actually search for real jobs.",
    position: "center",
    advance: "button",
  },
  {
    id: "type_search",
    target: "[data-tour='search-input']",
    title: "Search for a job",
    content: "Type a job title to get started — e.g. \"Frontend Developer\" or \"Marketing Manager\".",
    position: "bottom",
    advance: "dom_watch",
    watchFor: "[data-tour='search-input']",
    watchMode: "value",
    forced: true,
  },
  {
    id: "fill_profile",
    target: "[data-tour='fill-profile-btn']",
    title: "Fill from your profile",
    content: "This button fills the search query and all filters automatically from your saved profile — title, location, experience level.",
    position: "bottom",
    advance: "button",
  },
  {
    id: "hit_search",
    target: "[data-tour='search-btn']",
    title: "Now search!",
    content: "Click Search to find matching jobs across LinkedIn, Indeed, and jobsearch.az.",
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
    content: "We're scraping LinkedIn, Indeed, and jobsearch.az simultaneously. Results take 15–30 seconds because we fetch live listings in real time.",
    position: "bottom",
    advance: "dom_watch",
    watchFor: "[data-tour='first-job-card']",
    watchMode: "appear",
  },
  {
    id: "click_job",
    target: "[data-tour='first-job-card']",
    title: "A job appeared!",
    content: "Click the View Details button on this card to open the full vacancy — description, match score, and AI analysis.",
    position: "right",
    advance: "dom_watch",
    watchFor: "[data-tour='vacancy-panel']",
    watchMode: "appear",
    forced: true,
  },
  {
    id: "vacancy_overview",
    target: "[data-tour='vacancy-overview-tab']",
    title: "Job overview",
    content: "Here you'll find key details — location, work mode, salary, and the full job description. The match score card shows how closely this role fits your profile.",
    position: "left",
    advance: "button",
  },
  {
    id: "vacancy_improve",
    target: "[data-tour='vacancy-improve-tab']",
    title: "Improve your CV",
    content: "Switch to this tab to analyze your CV against the job and get AI-powered suggestions.",
    position: "left",
    advance: "button",
  },
  {
    id: "cv_upload",
    target: "[data-tour='cv-selector-area']",
    title: "Upload or select a CV",
    content: "If you haven't added a CV yet, click Upload file to import a PDF or DOCX. Already have one? Pick it from the dropdown, then hit Analyze CV to get your match score and tailored suggestions.",
    position: "left",
    advance: "button",
  },
  {
    id: "cv_analyzed",
    target: "[data-tour='cv-selector-area']",
    title: "Analyzing your CV…",
    content: "Hold tight — we're scoring your CV against this job description. Results will appear in a moment.",
    position: "left",
    advance: "dom_watch",
    watchFor: "[data-tour='edit-cv-btn']",
    watchMode: "appear",
  },
  {
    id: "cv_edit",
    target: "[data-tour='edit-cv-btn']",
    title: "CV scored!",
    content: "Your CV has been matched against the job. Click Edit CV to open the full editor and apply AI-powered improvements.",
    position: "left",
    advance: "dom_watch",
    watchFor: "[data-tour='workspace-cv-form']",
    watchMode: "appear",
    forced: true,
  },
  {
    id: "workspace_form",
    target: null,
    title: "CV Editor",
    content: "This is the structured CV editor. Click any field to update your personal info, work experience, education, skills, and more. All changes update the ATS preview in real time.",
    position: "center",
    advance: "button",
  },
  {
    id: "workspace_ats",
    target: "[data-tour='workspace-ats-btn']",
    title: "ATS Preview",
    content: "This live preview shows exactly how an ATS system reads your CV. Hover over any area to magnify it. It updates instantly as you type.",
    position: "bottom",
    advance: "button",
  },
  {
    id: "workspace_suggestions",
    target: "[data-tour='workspace-suggestions']",
    title: "AI Suggestions",
    content: "AI-powered improvements tailored to this specific job. Accept suggestions to apply them, decline ones that don't fit, or hit Apply All to accept everything at once.",
    position: "right",
    advance: "button",
  },
  {
    id: "workspace_check_impact",
    target: "[data-tour='workspace-check-impact-btn']",
    title: "Check Impact",
    content: "After accepting suggestions or making edits, click Check Impact to re-score your CV — see exactly how your changes improved your match percentage before downloading.",
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
}

const TourContext = createContext<TourContextValue>({
  active: false, stepIndex: 0, current: null, tabHint: null,
  start: () => {}, next: () => {}, prev: () => {}, skip: () => {},
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
      start, next, prev, skip,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() { return useContext(TourContext); }
