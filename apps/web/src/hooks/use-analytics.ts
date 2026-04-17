import { useQuery } from "@tanstack/react-query";
import { statsService } from "@/services/stats.service";

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => statsService.getAnalytics(),
    staleTime: 60 * 1000,
  });
}
