"use client";

import type { CVData } from "@/types";

/* ── Contact field URL resolution ── */

type ContactField = { label: string; href: string | null };

function resolveLinkedIn(value: string): string {
  if (!value) return "";
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("linkedin.com")) return `https://${v}`;
  // Handle: "in/handle", "yunis-aslanov", etc.
  const handle = v.replace(/^in\//, "");
  return `https://linkedin.com/in/${handle}`;
}

function resolvePortfolio(value: string): string {
  if (!value) return "";
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  // Looks like a domain if it has a dot
  if (v.includes(".")) return `https://${v}`;
  return "";
}

function buildContactFields(pi: CVData["personal_info"]): ContactField[] {
  const fields: ContactField[] = [];
  if (pi.phone) fields.push({ label: pi.phone, href: pi.phone_link?.trim() || `tel:${pi.phone.replace(/\s/g, "")}` });
  if (pi.email) fields.push({ label: pi.email, href: pi.email_link?.trim() || `mailto:${pi.email}` });
  if (pi.location) fields.push({ label: pi.location, href: null });
  if (pi.linkedin) fields.push({ label: pi.linkedin, href: pi.linkedin_link?.trim() || resolveLinkedIn(pi.linkedin) });
  if (pi.portfolio) {
    const href = pi.portfolio_link?.trim() || resolvePortfolio(pi.portfolio);
    fields.push({ label: pi.portfolio, href: href || null });
  }
  return fields;
}

/* Compute which text strings are new/changed vs original CV */
function computeChangedTexts(original: CVData, current: CVData): Set<string> {
  const changed = new Set<string>();

  if (current.personal_info.summary && current.personal_info.summary !== original.personal_info.summary) {
    changed.add(current.personal_info.summary);
  }

  const origBullets = new Set(original.experience.flatMap((e) => e.bullets));
  for (const entry of current.experience) {
    for (const bullet of entry.bullets) {
      if (bullet && !origBullets.has(bullet)) changed.add(bullet);
    }
  }

  const origSkillItems = new Set(original.skills.flatMap((g) => g.items));
  for (const group of current.skills) {
    for (const item of group.items) {
      if (item && !origSkillItems.has(item)) changed.add(item);
    }
  }

  const origCertNames = new Set(original.certifications.map((c) => c.name));
  for (const cert of current.certifications) {
    if (cert.name && !origCertNames.has(cert.name)) changed.add(cert.name);
  }

  return changed;
}

const HIGHLIGHT_STYLE: React.CSSProperties = {
  background: "rgba(34, 197, 94, 0.18)",
  borderRadius: "2px",
  padding: "0 2px",
  outline: "1px solid rgba(34, 197, 94, 0.35)",
};

function H({ text, changed }: { text: string; changed: Set<string> }) {
  if (!changed.has(text)) return <>{text}</>;
  return <span style={HIGHLIGHT_STYLE}>{text}</span>;
}

interface CVMiniPreviewProps {
  data: CVData;
  originalData?: CVData;
}

export default function CVMiniPreview({ data, originalData }: CVMiniPreviewProps) {
  const pi = data.personal_info;
  const changed = originalData ? computeChangedTexts(originalData, data) : new Set<string>();
  const hasChanges = changed.size > 0;

  return (
    <div
      className="bg-white text-gray-900 p-8"
      style={{ fontFamily: "'Arial', 'Helvetica', sans-serif", fontSize: "14px", lineHeight: "1.5", minHeight: "900px" }}
    >
      {/* Change legend */}
      {hasChanges && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", padding: "4px 8px", background: "rgba(34,197,94,0.08)", borderRadius: "6px", border: "1px solid rgba(34,197,94,0.2)" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: "rgba(34,197,94,0.4)", flexShrink: 0 }} />
          <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600 }}>
            {changed.size} change{changed.size !== 1 ? "s" : ""} highlighted
          </span>
        </div>
      )}

      {/* Header — name/contact left, photo right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a" }}>
            {pi.full_name || "Your Name"}
          </div>
          {buildContactFields(pi).length > 0 && (
            <div style={{ fontSize: "9px", color: "#555555", marginTop: "3px", display: "flex", flexWrap: "wrap", gap: "0 6px", alignItems: "center" }}>
              {buildContactFields(pi).map((field, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {i > 0 && <span style={{ color: "#aaa", userSelect: "none" }}>|</span>}
                  {field.href ? (
                    <a
                      href={field.href}
                      target={field.href.startsWith("mailto") || field.href.startsWith("tel") ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      style={{ color: "#555555", textDecoration: "none" }}
                      onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.textDecoration = "underline"; }}
                      onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.textDecoration = "none"; }}
                    >
                      {field.label}
                    </a>
                  ) : (
                    <span>{field.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        {pi.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pi.photo}
            alt="CV photo"
            style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        )}
      </div>
      <div style={{ borderBottom: "0.5px solid #d1d5db", marginBottom: "10px" }} />

      {/* Summary */}
      {pi.summary && (
        <p style={{ fontSize: "12px", color: "#334155", marginBottom: "14px", lineHeight: "1.6" }}>
          <H text={pi.summary} changed={changed} />
        </p>
      )}

      {/* Experience */}
      {data.experience.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", borderBottom: "0.4px solid #d1d5db", paddingBottom: "3px", marginBottom: "8px", marginTop: "10px" }}>
            Work Experience
          </div>
          {data.experience.map((e) => (
            <div key={e.id} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{e.title}</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>{e.start_date} – {e.end_date || "Present"}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>
                {e.company}{e.location ? `, ${e.location}` : ""}
              </div>
              {e.bullets.map((b, i) => (
                <div key={i} style={{ fontSize: "12px", color: "#334155", paddingLeft: "12px", position: "relative", marginBottom: "2px" }}>
                  <span style={{ position: "absolute", left: 0 }}>•</span>
                  <H text={b} changed={changed} />
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {data.education.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", borderBottom: "0.4px solid #d1d5db", paddingBottom: "3px", marginBottom: "8px", marginTop: "10px" }}>
            Education
          </div>
          {data.education.map((e) => {
            const title = e.institution || e.degree;
            const dateStr = e.start_date
              ? e.end_date ? `${e.start_date} — ${e.end_date}` : e.start_date
              : e.end_date || "";
            return (
              <div key={e.id} style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{title}</span>
                  {dateStr && <span style={{ fontSize: "11px", color: "#64748b" }}>{dateStr}</span>}
                </div>
                {(e.degree || e.field_of_study) && (
                  <div style={{ fontSize: "12px", color: "#475569", fontStyle: "italic" }}>
                    {[e.degree && e.institution ? e.degree : null, e.field_of_study].filter(Boolean).join(" · ")}
                  </div>
                )}
                {e.details && e.details.length > 0 && (
                  <div style={{ marginTop: "3px" }}>
                    {e.details.map((d, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "#334155", paddingLeft: "12px", position: "relative", marginBottom: "2px" }}>
                        <span style={{ position: "absolute", left: 0 }}>•</span>
                        {d}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Skills */}
      {data.skills.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", borderBottom: "0.4px solid #d1d5db", paddingBottom: "3px", marginBottom: "8px", marginTop: "10px" }}>
            Skills
          </div>
          {data.skills.map((g, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#334155", marginBottom: "3px" }}>
              <span style={{ fontWeight: 700 }}>{g.category}: </span>
              {g.items.map((item, j) => (
                <span key={j}>
                  {j > 0 && ", "}
                  <H text={item} changed={changed} />
                </span>
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Languages */}
      {data.languages.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", borderBottom: "0.4px solid #d1d5db", paddingBottom: "3px", marginBottom: "8px", marginTop: "10px" }}>
            Languages
          </div>
          <div style={{ fontSize: "12px", color: "#334155" }}>
            {data.languages.map((l) => l.level ? `${l.language} — ${l.level}` : l.language).join(", ")}
          </div>
        </section>
      )}

      {/* Certifications */}
      {data.certifications.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", borderBottom: "0.4px solid #d1d5db", paddingBottom: "3px", marginBottom: "8px", marginTop: "10px" }}>
            Certifications
          </div>
          {data.certifications.map((c) => (
            <div key={c.id} style={{ fontSize: "12px", color: "#334155", marginBottom: "3px" }}>
              <span style={{ fontWeight: 700 }}><H text={c.name} changed={changed} /></span>
              {c.issuer && <span style={{ color: "#475569" }}> — {c.issuer}</span>}
              {c.date && <span style={{ color: "#64748b" }}> ({c.date})</span>}
            </div>
          ))}
        </section>
      )}

      {/* Additional sections */}
      {Object.entries(data.additional_sections ?? {}).map(([name, items]) =>
        Array.isArray(items) && items.length > 0 ? (
          <section key={name} style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", borderBottom: "0.4px solid #d1d5db", paddingBottom: "3px", marginBottom: "8px", marginTop: "10px" }}>
              {name}
            </div>
            {items.map((item, i) => (
              <div key={i} style={{ fontSize: "12px", color: "#334155", paddingLeft: "12px", position: "relative", marginBottom: "2px" }}>
                <span style={{ position: "absolute", left: 0 }}>•</span>
                {item}
              </div>
            ))}
          </section>
        ) : null
      )}
    </div>
  );
}
