import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "JobClawd — AI-Powered Job Search";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0e0f14 0%, #151720 60%, #1a1b2e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "64px 80px",
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
        <div style={{ display: "flex", alignItems: "center", fontSize: "28px", fontWeight: 700, color: "#7b7cff", letterSpacing: "-0.5px" }}>
          jobcla
          <svg viewBox="1 7 46 34" style={{ width: "27px", height: "20px", display: "block" }}>
            <path d="M4 10 L14 38 L24 10" stroke="#7B7CFF" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
            <path d="M24 10 L34 38 L44 10" stroke="#7b7cff" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
          </svg>
          d
        </div>

        {/* Hero copy */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: "-2px",
              maxWidth: "900px",
            }}
          >
            AI-Powered
            <br />
            <span style={{ color: "#7b7cff" }}>Job Search</span>
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#9ca3af",
              maxWidth: "720px",
              lineHeight: 1.5,
            }}
          >
            Search 10+ job boards simultaneously. AI scores every vacancy against your CV.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", gap: "24px" }}>
            {["LinkedIn", "Indeed", "Glassdoor", "+ more"].map((src) => (
              <span
                key={src}
                style={{
                  fontSize: "15px",
                  color: "#6b7280",
                  padding: "6px 14px",
                  borderRadius: "100px",
                  border: "1px solid #2a2d3a",
                }}
              >
                {src}
              </span>
            ))}
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #7b7cff, #a78bfa)",
              color: "white",
              padding: "14px 32px",
              borderRadius: "10px",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            Get Started Free →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
