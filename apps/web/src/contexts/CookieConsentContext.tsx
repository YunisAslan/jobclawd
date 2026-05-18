"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ConsentState = "accepted" | "declined" | null;

const COOKIE_NAME = "jc_consent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function readCookie(): ConsentState {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )jc_consent=([^;]*)/);
  if (!match) return null;
  const val = decodeURIComponent(match[1]);
  return val === "accepted" || val === "declined" ? val : null;
}

function writeCookie(value: "accepted" | "declined") {
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

interface CookieConsentCtx {
  consent: ConsentState;
  resolved: boolean;
  accept: () => void;
  decline: () => void;
}

const CookieConsentContext = createContext<CookieConsentCtx | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setConsent(readCookie());
    setResolved(true);
  }, []);

  function accept() {
    writeCookie("accepted");
    setConsent("accepted");
  }

  function decline() {
    writeCookie("declined");
    setConsent("declined");
  }

  return (
    <CookieConsentContext.Provider value={{ consent, resolved, accept, decline }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  return ctx;
}
