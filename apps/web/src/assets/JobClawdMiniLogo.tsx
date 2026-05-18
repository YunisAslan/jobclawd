import { cn } from "@/lib/utils";

interface JobClawdMiniLogoProps {
  size?: number;
  className?: string;
}

export function JobClawdMiniLogo({ size = 28, className }: JobClawdMiniLogoProps) {
  const h = size;
  const w = h * (46 / 34);
  return (
    <svg
      viewBox="1 7 46 34"
      aria-label="JobClawd"
      focusable="false"
      className={cn("shrink-0", className)}
      style={{ width: w, height: h }}
    >
      <path d="M4 10 L14 38 L24 10" stroke="#7B7CFF" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
      <path d="M24 10 L34 38 L44 10" stroke="currentColor" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
    </svg>
  );
}
