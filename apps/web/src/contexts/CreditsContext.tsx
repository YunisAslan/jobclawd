"use client";

import { createContext, useCallback, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { creditsService } from "@/services/credits.service";

interface CreditsContextType {
  credits: number | null;
  maxCredits: number | null;
  isLoading: boolean;
  refetch: () => void;
}

const CreditsContext = createContext<CreditsContextType | null>(null);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["credits"],
    queryFn: () => creditsService.getBalance(),
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["credits"] });
  }, [queryClient]);

  return (
    <CreditsContext.Provider
      value={{
        credits: data?.credits ?? null,
        maxCredits: data?.max_credits ?? null,
        isLoading,
        refetch,
      }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used inside CreditsProvider");
  return ctx;
}
