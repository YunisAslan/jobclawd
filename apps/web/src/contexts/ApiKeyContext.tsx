"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiKeysService } from "@/services/api-keys.service";
import { setNoApiKeyHandler } from "@/lib/api-key-events";
import { ApiKeyModal } from "@/components/settings/ApiKeyModal";

interface ApiKeyContextType {
  hasKey: boolean;
  keyHint: string | null;
  isLoading: boolean;
  openModal: () => void;
  refetch: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | null>(null);

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["openai-key-status"],
    queryFn: () => apiKeysService.getStatus(),
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["openai-key-status"] });
  }, [queryClient]);

  const openModal = useCallback(() => setModalOpen(true), []);

  // Let the axios layer open this modal when any AI call returns 403 NO_API_KEY.
  useEffect(() => {
    setNoApiKeyHandler(() => setModalOpen(true));
    return () => setNoApiKeyHandler(null);
  }, []);

  return (
    <ApiKeyContext.Provider
      value={{
        hasKey: data?.has_key ?? false,
        keyHint: data?.key_hint ?? null,
        isLoading,
        openModal,
        refetch,
      }}
    >
      {children}
      <ApiKeyModal open={modalOpen} onOpenChange={setModalOpen} onSaved={refetch} />
    </ApiKeyContext.Provider>
  );
}

export function useApiKey() {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error("useApiKey must be used inside ApiKeyProvider");
  return ctx;
}
