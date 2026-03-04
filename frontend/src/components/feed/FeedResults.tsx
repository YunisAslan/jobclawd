import { JobListing } from "@/types";
import FeedJobCard from "@/components/feed/FeedJobCard";
import FeedResultSectionHeader from "@/components/feed/FeedResultSectionHeader";
import { Compass, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

interface FeedResultsProps {
  highMatch: JobListing[];
  needsReview: JobListing[];
  loading?: boolean;
  hasSearched?: boolean;
}

const noop = () => {};

export default function FeedResults({
  highMatch,
  needsReview,
  loading,
  hasSearched,
}: FeedResultsProps) {
  if (!hasSearched && !loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in duration-300">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Compass className="size-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          Ready to explore
        </h3>
        <p className="max-w-xs text-sm">
          Select your desired profession and preferences above. I'll scour the
          web to find the best matching opportunities for you.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 border border-border/50 rounded-lg space-y-3 bg-card h-40 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="h-5 w-2/3 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-muted/50 rounded-full animate-pulse" />
                  <div className="h-8 w-20 bg-muted/50 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (highMatch.length === 0 && needsReview.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in duration-300">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Inbox className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          No matches found
        </h3>
        <p className="max-w-xs text-sm">
          Try adjusting your search criteria or removing some filters to see
          more results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {highMatch.length > 0 && (
        <section className="space-y-3">
          <FeedResultSectionHeader
            color="primary"
            label="High Match"
            count={highMatch.length}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {highMatch.map((job) => (
              <FeedJobCard
                key={job.url}
                job={job}
                selected={false}
                onToggleSelect={noop}
                onApply={noop}
                onSkip={noop}
                onDetails={noop}
                onHideCompany={noop}
              />
            ))}
          </div>
        </section>
      )}

      {needsReview.length > 0 && (
        <section className="space-y-3">
          <FeedResultSectionHeader
            color="warning"
            label="Needs Review"
            count={needsReview.length}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {needsReview.map((job) => (
              <FeedJobCard
                key={job.url}
                job={job}
                selected={false}
                onToggleSelect={noop}
                onApply={noop}
                onSkip={noop}
                onDetails={noop}
                onHideCompany={noop}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
