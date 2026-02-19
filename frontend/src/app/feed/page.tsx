"use client";

import TopBar from "@/components/layout/TopBar";
import FeedJobCard from "@/components/feed/FeedJobCard";
import JobDetailDrawer from "@/components/feed/JobDetailDrawer";
import BulkActionBar from "@/components/feed/BulkActionBar";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { Card, CardContent } from "@/components/ui/Card";
import { useFeed, ALL_SOURCES } from "@/hooks/use-feed";

export default function FeedPage() {
  const {
    query, setQuery, sources, loading, error,
    selected, drawerJob, setDrawerJob, bulkApplying,
    handleSearch, toggleSource, toggleSelect,
    handleSkip, handleApplied, handleBulkApply, clearSelected,
    visible, highMatch, needsReview, hasScoring, allVisible, jobs,
  } = useFeed();

  return (
    <div>
      <TopBar title="Job Feed" />
      <div className="p-6 space-y-6">
        {/* Search bar */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter job title... (e.g. frontend developer)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Sources:</span>
              {ALL_SOURCES.map((s) => (
                <div key={s.value} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`src-${s.value}`}
                    checked={sources.includes(s.value)}
                    onCheckedChange={() => toggleSource(s.value)}
                  />
                  <Label htmlFor={`src-${s.value}`} className="text-sm font-normal cursor-pointer">
                    {s.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Results */}
        {!loading && visible.length > 0 && (
          <div className="space-y-6">
            {hasScoring ? (
              <>
                {highMatch.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary" />
                      High match
                      <span className="text-muted-foreground font-normal">({highMatch.length})</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {highMatch.map((job) => (
                        <FeedJobCard key={job.url} job={job}
                          selected={selected.has(job.url)}
                          onToggleSelect={() => toggleSelect(job.url)}
                          onApply={() => setDrawerJob(job)}
                          onSkip={() => handleSkip(job.url)}
                          onDetails={() => setDrawerJob(job)} />
                      ))}
                    </div>
                  </section>
                )}
                {needsReview.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-warning" />
                      Needs review
                      <span className="text-muted-foreground font-normal">({needsReview.length})</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {needsReview.map((job) => (
                        <FeedJobCard key={job.url} job={job}
                          selected={selected.has(job.url)}
                          onToggleSelect={() => toggleSelect(job.url)}
                          onApply={() => setDrawerJob(job)}
                          onSkip={() => handleSkip(job.url)}
                          onDetails={() => setDrawerJob(job)} />
                      ))}
                    </div>
                  </section>
                )}
                {highMatch.length === 0 && needsReview.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No matching jobs found.
                  </p>
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allVisible.map((job) => (
                  <FeedJobCard key={job.url} job={job}
                    selected={selected.has(job.url)}
                    onToggleSelect={() => toggleSelect(job.url)}
                    onApply={() => setDrawerJob(job)}
                    onSkip={() => handleSkip(job.url)}
                    onDetails={() => setDrawerJob(job)} />
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && jobs.length > 0 && visible.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            All jobs have been skipped.
          </p>
        )}

        {!loading && jobs.length === 0 && query && (
          <p className="text-center text-muted-foreground py-8 text-sm">No results found.</p>
        )}
      </div>

      <JobDetailDrawer job={drawerJob} onClose={() => setDrawerJob(null)} onApplied={handleApplied} />
      <BulkActionBar count={selected.size} onApplyAll={handleBulkApply} onClear={clearSelected} applying={bulkApplying} />
    </div>
  );
}
