import { JobListing } from "@/types";
import FeedJobCard from "@/components/feed/FeedJobCard";
import FeedResultSectionHeader from "@/components/feed/FeedResultSectionHeader";

interface FeedResultsProps {
  highMatch: JobListing[];
  needsReview: JobListing[];
}

const noop = () => {};

export default function FeedResults({
  highMatch,
  needsReview,
}: FeedResultsProps) {
  return (
    <div className="space-y-6">
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
    </div>
  );
}
