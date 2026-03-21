import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { screeningService } from "@/services/screening.service";
import { ScreeningAnswer } from "@/types";

export const SCREENING_QUERY_KEY = ["screening-answers"];

export function useScreeningAnswers() {
  return useQuery({
    queryKey: SCREENING_QUERY_KEY,
    queryFn: () => screeningService.getAnswers(),
    staleTime: Infinity,
  });
}

export function useUpsertScreeningAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ question, answer }: { question: string; answer: string }) =>
      screeningService.upsertAnswer(question, answer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCREENING_QUERY_KEY });
    },
  });
}

export function useDeleteScreeningAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => screeningService.deleteAnswer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCREENING_QUERY_KEY });
    },
  });
}
