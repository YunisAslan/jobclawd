import { useQuery } from "@tanstack/react-query";
import { metaService } from "@/services/meta.service";
import { MetaFiltersResponse } from "@/components/feed/types";

export function useMetaFilters() {
  return useQuery<MetaFiltersResponse>({
    queryKey: ["meta-filters"],
    queryFn: () => metaService.getFilters(),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours caching
  });
}
