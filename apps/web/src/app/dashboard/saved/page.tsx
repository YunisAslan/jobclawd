"use client";

import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import SavedJobCard from "@/components/saved/SavedJobCard";
import VacancyPanel from "@/components/feed/vacancy/VacancyPanel";
import { useSavedVacancies } from "@/hooks/use-saved-vacancies";
import { Bookmark } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { JobListing } from "@/types";
import Link from "next/link";

export default function SavedJobsPage() {
  const { vacancies, loading, unsaveMutation } = useSavedVacancies();
  const [panelJob, setPanelJob] = useState<JobListing | null>(null);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);

  const handleRemove = (url: string) => {
    setRemovingUrl(url);
    unsaveMutation.mutate(url, {
      onSettled: () => setRemovingUrl(null),
    });
  };

  return (
    <>
      <TopBar title="Saved Jobs" />

      <div className="p-6 space-y-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 border border-border/30 rounded-2xl space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1 rounded-md" />
                  <Skeleton className="h-8 flex-1 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : vacancies.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in duration-300">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bookmark className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No saved jobs yet</h3>
            <p className="max-w-sm text-sm mb-5">
              Browse the job feed to find and save positions you want to review later.
              Saved jobs are kept for 7 days.
            </p>
            <Link
              href="/dashboard/feed"
              className="text-sm text-primary font-medium hover:underline"
            >
              Go to Job Feed
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <span className="text-xs text-muted-foreground">
                {vacancies.length} saved job{vacancies.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-muted-foreground/50">
                Auto-removed after 7 days
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vacancies.map((vacancy) => (
                <SavedJobCard
                  key={vacancy.id}
                  vacancy={vacancy}
                  onOpen={() => setPanelJob(vacancy.job_data)}
                  onRemove={() => handleRemove(vacancy.job_url)}
                  removing={removingUrl === vacancy.job_url}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <VacancyPanel job={panelJob} onClose={() => setPanelJob(null)} />
    </>
  );
}
