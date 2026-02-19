"use client";

import { useEffect, useState } from "react";
import { getApplications, updateApplicationStatus } from "@/lib/api";
import { ApplicationRecord, ApplicationStatus } from "@/types";
import TopBar from "@/components/layout/TopBar";
import ApplicationsTable from "@/components/applications/ApplicationsTable";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ApplicationsPage() {
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApplications()
      .then(setRecords)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: number, status: ApplicationStatus) => {
    try {
      const updated = await updateApplicationStatus(id, status);
      setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch { /* silent */ }
  };

  return (
    <div>
      <TopBar title="Applications" />
      <div className="p-6">
        {error && (
          <p className="mb-4 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-0">
              <ApplicationsTable records={records} onStatusChange={handleStatusChange} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
