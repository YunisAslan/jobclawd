"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface FeedUrlContextValue {
  feedUrl: string;
  setFeedUrl: (url: string) => void;
}

const FeedUrlContext = createContext<FeedUrlContextValue>({
  feedUrl: "/dashboard/feed",
  setFeedUrl: () => {},
});

export function FeedUrlProvider({ children }: { children: ReactNode }) {
  const [feedUrl, setFeedUrl] = useState("/dashboard/feed");
  return (
    <FeedUrlContext.Provider value={{ feedUrl, setFeedUrl }}>{children}</FeedUrlContext.Provider>
  );
}

export function useFeedUrl() {
  return useContext(FeedUrlContext);
}
