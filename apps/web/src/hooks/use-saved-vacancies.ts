import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savedVacanciesService } from "@/services/saved-vacancies.service";
import type { JobListing } from "@/types";
import { useCallback, useMemo } from "react";

export function useSavedVacancies() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["saved-vacancies"],
    queryFn: () => savedVacanciesService.list(),
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: ({ job_url, job_data }: { job_url: string; job_data: JobListing }) =>
      savedVacanciesService.save(job_url, job_data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-vacancies"] });
      qc.invalidateQueries({ queryKey: ["saved-check"] });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: (job_url: string) => savedVacanciesService.unsave(job_url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-vacancies"] });
      qc.invalidateQueries({ queryKey: ["saved-check"] });
    },
  });

  return {
    vacancies: data?.vacancies ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error: error ? String(error) : null,
    saveMutation,
    unsaveMutation,
  };
}

export function useSavedCheck(urls: string[]) {
  const { data } = useQuery({
    queryKey: ["saved-check", urls],
    queryFn: () => savedVacanciesService.batchCheck(urls),
    enabled: urls.length > 0,
    staleTime: 60_000,
  });

  const savedSet = useMemo(
    () => new Set(data?.saved_urls ?? []),
    [data?.saved_urls],
  );

  const isSaved = useCallback(
    (url: string) => savedSet.has(url),
    [savedSet],
  );

  return { savedSet, isSaved };
}
