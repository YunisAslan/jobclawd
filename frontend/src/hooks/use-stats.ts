import { useQuery } from "@tanstack/react-query";
import { statsService } from "@/services/stats.service";

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => statsService.getStats(),
    staleTime: 30 * 1000,
  });
}
