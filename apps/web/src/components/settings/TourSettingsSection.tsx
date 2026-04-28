"use client";

import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTour, clearTourSeen } from "@/contexts/TourContext";

export default function TourSettingsSection() {
  const { start } = useTour();
  const router = useRouter();

  function handleRestart() {
    clearTourSeen();
    router.push("/dashboard/feed");
    setTimeout(start, 600);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Replay the guided walkthrough to explore all features again.
      </p>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 gap-2"
        onClick={handleRestart}
      >
        <Compass className="size-4" />
        Start tour
      </Button>
    </div>
  );
}
