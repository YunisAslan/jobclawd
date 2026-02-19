"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import AutopilotToggle from "@/components/settings/AutopilotToggle";
import SMTPForm from "@/components/settings/SMTPForm";
import { getAutopilotSettings, getSMTPSettings } from "@/lib/api";
import { SMTPSettings } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsPage() {
  const [autopilot, setAutopilot] = useState(false);
  const [smtp, setSmtp] = useState<SMTPSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAutopilotSettings().catch(() => ({ enabled: false })),
      getSMTPSettings().catch(() => null),
    ]).then(([ap, sm]) => {
      setAutopilot(ap.enabled);
      setSmtp(sm);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <TopBar title="Settings" autopilotEnabled={autopilot} />
      <div className="p-6 max-w-2xl space-y-5">
        {loading ? (
          <>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </>
        ) : (
          <>
            {/* Autopilot */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Autopilot</CardTitle>
                <CardDescription>
                  Automatically apply to high-match jobs as soon as they are found.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AutopilotToggle enabled={autopilot} onChanged={setAutopilot} />
              </CardContent>
            </Card>

            {/* SMTP */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SMTP configuration</CardTitle>
                <CardDescription>
                  Email sending settings for autopilot. Gmail App Password is recommended.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-5">
                <SMTPForm initial={smtp} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
