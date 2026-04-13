"use client";

import { useRef, useState } from "react";
import { CVLink } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { profileService } from "@/services/profile.service";
import { Badge } from "@/components/ui/Badge";
import { FileText, FileType2, Loader2, UploadCloud, ExternalLink, Trash2, Sparkles } from "lucide-react";
import { API_BASE_URL } from "@/lib/endpoints";

interface CVLinkManagerProps {
  cvLinks: CVLink[];
  onChange: (links: CVLink[]) => void;
}

function getFileExtension(url: string) {
  const path = (url || "").split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return "PDF";
  if (path.endsWith(".docx")) return "DOCX";
  if (path.endsWith(".doc")) return "DOC";
  return "FILE";
}

export default function CVLinkManager({ cvLinks, onChange }: CVLinkManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const update = (index: number, field: keyof CVLink, value: string) =>
    onChange(cvLinks.map((cv, i) => (i === index ? { ...cv, [field]: value } : cv)));

  const remove = (index: number) => onChange(cvLinks.filter((_, i) => i !== index));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(true);
    setUploadError(null);
    try {
      const result = await profileService.uploadCV(file);
      onChange([...cvLinks, result]);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 py-3.5 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(123,124,255,0.06),transparent_30%)]" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex size-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
              <FileText className="size-4.5" />
            </div>
            <div className="space-y-1">
              <div className="flex">
                <h3 className="text-sm font-semibold text-foreground">Your CV library</h3>
              </div>
              <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                Keep only the resume files you want to compare, improve, and export.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="gap-2 rounded-xl px-4"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
              {uploading ? "Uploading..." : "Upload CV"}
            </Button>
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-background/80 px-2 py-0.5 ring-1 ring-border/60">Max 10 MB</span>
          <span className="rounded-full bg-background/80 px-2 py-0.5 ring-1 ring-border/60">Files only</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 ring-1 ring-border/60">
            <Sparkles className="size-3" />
            PDF and DOCX work best
          </span>
        </div>
      </div>

      {cvLinks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center">
          <div className="mx-auto mb-2.5 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileType2 className="size-4.5" />
          </div>
          <h4 className="text-sm font-medium text-foreground">No CVs uploaded yet</h4>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-muted-foreground">
            Start with your main resume, then add variants later if you want to compare them.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {cvLinks.map((cv, i) => (
            <div
              key={cv.url || i}
              className="group rounded-2xl border border-border/60 bg-card/80 p-3.5 shadow-sm transition-colors hover:border-primary/25"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-96 gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground">
                    <FileText className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full px-2 text-[10px] font-semibold tracking-[0.14em]">
                        {getFileExtension(cv.url)}
                      </Badge>
                    </div>
                    <Input
                      placeholder="Main CV"
                      value={cv.name}
                      onChange={(e) => update(i, "name", e.target.value)}
                      className="h-9 rounded-xl border-border/70 bg-background/80 text-sm font-medium"
                    />
                    {/* <p className="truncate text-[11px] text-muted-foreground">{cv.url.split("/").pop() ?? cv.url}</p> */}
                  </div>
                </div>

                <div className="flex items-center gap-2 md:pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl"
                    onClick={() => window.open(`${API_BASE_URL}${cv.url}`, "_blank")}
                  >
                    <ExternalLink className="size-3.5" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadError && <p className="text-[11px] text-destructive">{uploadError}</p>}
    </div>
  );
}
