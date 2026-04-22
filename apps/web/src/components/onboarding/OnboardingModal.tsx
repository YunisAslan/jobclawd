"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload, CheckCircle2, ArrowRight, Loader2, X,
  Search, Briefcase, Building2, ExternalLink, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { profileService } from "@/services/profile.service";
import { cvMatchService } from "@/services/cv-match.service";
import { jobsService } from "@/services/jobs.service";
import { useProfile } from "@/contexts/ProfileContext";
import { PROFILE_QUERY_KEY } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import type { JobListing, CVMatchAnalysis } from "@/types";

type Step = 1 | 2 | 3;

const SOURCE_COLORS: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  indeed: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  jobsearch: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const MATCH_COLORS: Record<string, string> = {
  excellent: "text-emerald-500",
  good: "text-primary",
  fair: "text-amber-500",
  low: "text-destructive",
};

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const color =
    score >= 75 ? "#10b981" : score >= 55 ? "var(--primary)" : score >= 35 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative size-28 mx-auto">
      <svg className="size-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor"
          strokeWidth="8" className="text-muted/40" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={fill}
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{score}%</span>
      </div>
    </div>
  );
}

interface Props {
  userName: string;
  onClose: () => void;
}

export default function OnboardingModal({ userName, onClose }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, setProfile } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [dragging, setDragging] = useState(false);

  // Step 1 — CV
  const [uploading, setUploading] = useState(false);
  const [uploadedCv, setUploadedCv] = useState<{ name: string; url: string } | null>(null);
  const [uploadError, setUploadError] = useState("");

  // Step 2 — Job search
  const [query, setQuery] = useState(profile.headline ?? "");
  const [searching, setSearching] = useState(false);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [searchError, setSearchError] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);

  // Step 3 — Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CVMatchAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  const firstName = userName.split(" ")[0] || "there";

  // ── Step 1: Upload CV ────────────────────────────────────────────────────

  async function handleFileSelect(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const result = await profileService.uploadCV(file);
      setUploadedCv(result);
      const updated = {
        ...profile,
        cv_links: [...(profile.cv_links ?? []), { name: result.name, url: result.url }],
      };
      await profileService.saveProfile(updated);
      setProfile(updated);
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Step 2: Search ───────────────────────────────────────────────────────

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearchError("");
    setSearching(true);
    setJobs([]);
    setSelectedJob(null);
    try {
      const res = await jobsService.search(q, ["jobsearch", "linkedin", "indeed"]);
      const top = res.jobs.slice(0, 5);
      if (top.length === 0) {
        setSearchError("No jobs found. Try a different title.");
      } else {
        setJobs(top);
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function selectJob(job: JobListing) {
    setSelectedJob(job);
    setStep(3);

    const cv = uploadedCv ?? profile.cv_links?.[0];
    if (!cv) return;

    setAnalyzing(true);
    setAnalysisError("");
    try {
      const result = await cvMatchService.getAnalysis(job.url, cv.url);
      setAnalysis(result);
    } catch {
      setAnalysisError("Analysis failed. You can retry from the full vacancy view.");
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Finish ───────────────────────────────────────────────────────────────

  async function handleFinish() {
    try { await profileService.completeOnboarding(); } catch { /* best-effort */ }
    queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    onClose();
    if (selectedJob) {
      router.push(`/dashboard/feed?job=${encodeURIComponent(selectedJob.url)}`);
    } else {
      router.push("/dashboard/feed");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[3px]">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-4 pb-0.5">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={cn(
              "size-1.5 rounded-full transition-all duration-300",
              s === step ? "bg-primary scale-125 w-4" : s < step ? "bg-primary/40" : "bg-muted-foreground/20",
            )} />
          ))}
        </div>

        {/* ── STEP 1: Upload CV ── */}
        {step === 1 && (
          <div className="px-7 pt-5 pb-7 space-y-5">
            <div>
              <p className="text-xs text-primary font-semibold tracking-wide uppercase mb-1">Step 1 of 3</p>
              <h2 className="text-xl font-bold text-foreground">Hey {firstName}, upload your CV 👋</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Your CV powers match scoring and AI suggestions. We'll use it in the next step.
              </p>
            </div>

            {uploadedCv ? (
              <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3.5">
                <CheckCircle2 className="size-5 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{uploadedCv.name}</p>
                  <p className="text-xs text-muted-foreground">Ready for analysis</p>
                </div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0">
                  Replace
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragging(false);
                  const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20",
                  uploading && "pointer-events-none opacity-60",
                )}
              >
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  {uploading ? <Loader2 className="size-5 text-primary animate-spin" /> : <Upload className="size-5 text-primary" />}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {uploading ? "Uploading…" : "Drop your CV here or click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF or DOCX · up to 10 MB</p>
                </div>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

            {uploadError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <X className="size-3 shrink-0" />{uploadError}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setStep(2)}
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">
                Skip for now
              </button>
              <Button onClick={() => setStep(2)} disabled={uploading}>
                {uploadedCv ? "Next" : "Skip"} <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Search ── */}
        {step === 2 && (
          <div className="px-7 pt-5 pb-7 space-y-4">
            <div>
              <p className="text-xs text-primary font-semibold tracking-wide uppercase mb-1">Step 2 of 3</p>
              <h2 className="text-xl font-bold text-foreground">Find a job to test against</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Search for a role, pick one, and we'll score your CV against it right now.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="e.g. Frontend Developer"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                disabled={searching}
                autoFocus
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching || !query.trim()} size="sm" className="shrink-0">
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>

            {searchError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <X className="size-3 shrink-0" />{searchError}
              </p>
            )}

            {searching && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                ))}
                <p className="text-xs text-center text-muted-foreground">Searching across 3 sources…</p>
              </div>
            )}

            {jobs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Pick a job to score your CV against:
                </p>
                {jobs.map((job) => (
                  <button
                    key={job.url}
                    type="button"
                    onClick={() => selectJob(job)}
                    className="w-full text-left flex items-start gap-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/20 px-3.5 py-3 transition-colors group"
                  >
                    <div className="size-8 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {job.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 className="size-3 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                        <span className={cn(
                          "ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize",
                          SOURCE_COLORS[job.source] ?? "bg-muted text-muted-foreground",
                        )}>
                          {job.source === "jobsearch" ? "jobsearch.az" : job.source}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0 self-center transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {!searching && jobs.length === 0 && !searchError && (
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setStep(1)}
                  className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
                <Button variant="ghost" size="sm" onClick={handleFinish}>
                  Skip to dashboard
                </Button>
              </div>
            )}

            {jobs.length > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <button type="button" onClick={() => setStep(1)}
                  className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back
                </button>
                <button type="button" onClick={handleFinish}
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">
                  Skip to dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Score ── */}
        {step === 3 && (
          <div className="px-7 pt-5 pb-7 space-y-5">
            <div>
              <p className="text-xs text-primary font-semibold tracking-wide uppercase mb-1">Step 3 of 3</p>
              <h2 className="text-xl font-bold text-foreground">Your match score</h2>
              {selectedJob && (
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  <span className="font-medium text-foreground">{selectedJob.title}</span>
                  {" · "}{selectedJob.company}
                </p>
              )}
            </div>

            {/* No CV uploaded */}
            {!uploadedCv && !profile.cv_links?.length && (
              <div className="text-center py-4 space-y-3">
                <div className="size-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a CV in step 1 to see your match score.
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                  ← Upload CV
                </Button>
              </div>
            )}

            {/* Analyzing */}
            {(uploadedCv || profile.cv_links?.length > 0) && analyzing && (
              <div className="text-center py-6 space-y-3">
                <div className="size-14 rounded-full border-2 border-border border-t-primary animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-medium text-foreground">Analyzing your CV…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">AI is scoring your match</p>
                </div>
              </div>
            )}

            {/* Analysis error */}
            {analysisError && !analyzing && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-sm text-muted-foreground">
                {analysisError}
              </div>
            )}

            {/* Score result */}
            {analysis && !analyzing && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <ScoreRing score={analysis.overall_score} />
                  <span className={cn(
                    "inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-muted/60 capitalize",
                    MATCH_COLORS[analysis.match_level] ?? "text-foreground",
                  )}>
                    {analysis.match_level} match
                  </span>
                  {analysis.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                      {analysis.summary}
                    </p>
                  )}
                </div>

                {analysis.categories?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category breakdown</p>
                    {analysis.categories.slice(0, 3).map((cat) => (
                      <div key={cat.category} className="flex items-center gap-2.5">
                        <span className="text-xs text-muted-foreground w-28 truncate capitalize">
                          {cat.category.replace(/_/g, " ")}
                        </span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-700"
                            style={{ width: `${cat.score}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-foreground w-8 text-right">{cat.score}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button className="flex-1" onClick={handleFinish}>
                <Sparkles className="size-4 mr-1.5" />
                {analysis ? "View full analysis" : "Go to feed"}
                <ExternalLink className="size-3.5 ml-1.5 opacity-60" />
              </Button>
            </div>

            {analysis && (
              <p className="text-xs text-center text-muted-foreground -mt-2">
                You'll see suggestions, missing keywords, and more in the full view.
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
