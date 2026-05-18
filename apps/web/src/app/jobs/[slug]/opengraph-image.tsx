import { ImageResponse } from "next/og";
import { slugToReadableParts } from "@/lib/seo";

export const runtime = "edge";
export const alt = "JobClawd Job Posting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const { title, company } = slugToReadableParts(decoded);

  const displayTitle = title || "Job Opportunity";
  const displayCompany = company || "Company";

  return new ImageResponse(
    (
      <div
        style={{
          background:
            "linear-gradient(135deg, #0e0f14 0%, #151720 60%, #1a1b2e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "60px 80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #7b7cff 0%, #a78bfa 100%)",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", fontSize: "22px", fontWeight: 700, color: "#7b7cff", letterSpacing: "-0.5px" }}>
          jobcla
          <svg viewBox="1 7 46 34" style={{ width: "21px", height: "16px", display: "block" }}>
            <path d="M4 10 L14 38 L24 10" stroke="#7B7CFF" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
            <path d="M24 10 L34 38 L44 10" stroke="#7b7cff" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
          </svg>
          d
        </div>

        {/* Job info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              fontSize: "16px",
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "3px",
              fontWeight: 500,
            }}
          >
            {displayCompany}
          </div>
          <div
            style={{
              fontSize: displayTitle.length > 40 ? "44px" : "56px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-1.5px",
              maxWidth: "900px",
            }}
          >
            {displayTitle}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <span style={{ color: "#6b7280", fontSize: "16px" }}>
              AI-scored vacancy
            </span>
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #7b7cff, #a78bfa)",
              color: "white",
              padding: "13px 30px",
              borderRadius: "10px",
              fontSize: "17px",
              fontWeight: 600,
            }}
          >
            Apply on JobClawd →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
