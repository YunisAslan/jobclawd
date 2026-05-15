import { useEffect, useRef } from "react";

type Options = {
  /** Whether more data is available to load. */
  hasMore: boolean;
  /** Whether a load is currently in flight. */
  loading: boolean;
  /** Called when the sentinel enters the viewport. */
  onLoadMore: () => void;
  /** Pixels of root margin below the sentinel; triggers load before reaching bottom. */
  rootMargin?: string;
  /** Disable the observer (e.g. during initial fetch). */
  enabled?: boolean;
};

/**
 * Attach to a sentinel <div> at the bottom of a scrollable list.
 * Calls `onLoadMore` when the sentinel intersects the viewport (or root + margin),
 * with built-in guards against double-fires while a load is in flight.
 */
export function useInfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  rootMargin = "600px",
  enabled = true,
}: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Keep latest callback in a ref so the observer doesn't need to re-subscribe
  // whenever the parent re-renders with a new function reference.
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!enabled || !hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, hasMore, loading, rootMargin]);

  return sentinelRef;
}
