import { cn } from "@/lib/utils";

interface JobClawdLogoProps {
  /**
   * Font-size in px — controls the overall scale of the wordmark.
   * The inline "w" SVG scales proportionally. Default: 20.
   */
  size?: number;
  className?: string;
}

/**
 * The JobClawd wordmark: "jobcla" + angular-W SVG + "d".
 * The first W stroke is always brand-purple (#7B7CFF); the second inherits currentColor.
 * Works in any colour context — just set the parent text colour.
 */
export function JobClawdLogo({ size = 20, className }: JobClawdLogoProps) {
  // The SVG viewBox is "1 7 46 34" → internal W occupies ~28 units of height.
  // Scale it to 82% of font-size so it optically matches the cap-height.
  const svgH = size * 0.82;
  const svgW = svgH * (46 / 34);

  return (
    <span
      className={cn(
        "inline-flex items-center font-bold tracking-tight leading-none select-none",
        className
      )}
      style={{ fontSize: size }}
      aria-label="JobClawd"
      role="img"
    >
      jobcla
      <svg
        viewBox="1 7 46 34"
        aria-hidden="true"
        focusable="false"
        style={{ width: svgW, height: svgH, flexShrink: 0 }}
      >
        <path
          d="M4 10 L14 38 L24 10"
          stroke="#7B7CFF"
          strokeWidth="6"
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
        />
        <path
          d="M24 10 L34 38 L44 10"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
        />
      </svg>
      d
    </span>
  );
}
