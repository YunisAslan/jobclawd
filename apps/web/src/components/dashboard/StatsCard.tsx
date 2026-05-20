import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/Card";

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone: "primary" | "secondary" | "success" | "muted";
}

const TONE_CLASS: Record<StatsCardProps["tone"], string> = {
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  success: "bg-success/15 text-success",
  muted: "bg-muted text-muted-foreground",
};

export default function StatsCard({ label, value, icon, tone }: StatsCardProps) {
  return (
    <Card className="gap-0 py-4 sm:py-5">
      <CardContent className="px-4 sm:px-5">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{label}</span>
          <span
            className={`size-8 sm:size-9 rounded-lg flex items-center justify-center shrink-0 ${TONE_CLASS[tone]}`}
          >
            {icon}
          </span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
