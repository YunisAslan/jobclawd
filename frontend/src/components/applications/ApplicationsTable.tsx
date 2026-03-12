"use client";

import { ApplicationRecord, ApplicationStatus } from "./types";
import StatusBadge from "./StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

const TABS: { value: ApplicationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "replied", label: "Replied" },
  { value: "rejected", label: "Rejected" },
];

interface ApplicationsTableProps {
  records: ApplicationRecord[];
  onStatusChange: (id: number, status: ApplicationStatus) => void;
}

function RecordsTable({
  records,
  onStatusChange,
}: {
  records: ApplicationRecord[];
  onStatusChange: (id: number, status: ApplicationStatus) => void;
}) {
  if (records.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12 text-sm">
        No applications found.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>CV</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium max-w-[140px] truncate">
              {r.company}
            </TableCell>
            <TableCell className="max-w-[200px]">
              <Link
                href={r.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors line-clamp-1"
              >
                {r.job_title}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">
              {formatDate(r.sent_at, { year: "numeric" })}
            </TableCell>
            <TableCell className="text-muted-foreground max-w-[120px] truncate">
              {r.cv_name ?? "—"}
            </TableCell>
            <TableCell>
              <StatusBadge
                status={r.status as ApplicationStatus}
                onChange={(s) => onStatusChange(r.id, s)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ApplicationsTable({
  records,
  onStatusChange,
}: ApplicationsTableProps) {
  const filtered = (tab: ApplicationStatus | "all") =>
    tab === "all" ? records : records.filter((r) => r.status === tab);

  return (
    <Tabs defaultValue="all">
      <TabsList
        variant="line"
        className="w-full justify-start mb-4 h-auto p-0 rounded-none border-b bg-transparent"
      >
        {TABS.map((t) => {
          const count =
            t.value === "all"
              ? records.length
              : records.filter((r) => r.status === t.value).length;
          return (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="pb-3 text-sm rounded-none data-[state=active]:shadow-none"
            >
              {t.label}
              <span className="ml-1 text-xs text-muted-foreground">
                ({count})
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          <RecordsTable
            records={filtered(t.value)}
            onStatusChange={onStatusChange}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
