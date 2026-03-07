"use client";

import { useRef, useState } from "react";
import { CVLink } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { profileService } from "@/services/profile.service";
import {
  XIcon,
  PlusIcon,
  Upload,
  Link2,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/endpoints";

interface CVLinkManagerProps {
  cvLinks: CVLink[];
  onChange: (links: CVLink[]) => void;
}

function isUploadedFile(url: string) {
  return url.startsWith("/api/files/cv/");
}

export default function CVLinkManager({
  cvLinks,
  onChange,
}: CVLinkManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const update = (index: number, field: keyof CVLink, value: string) =>
    onChange(
      cvLinks.map((cv, i) => (i === index ? { ...cv, [field]: value } : cv)),
    );

  const remove = (index: number) =>
    onChange(cvLinks.filter((_, i) => i !== index));

  const addLink = () => onChange([...cvLinks, { name: "", url: "" }]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await profileService.uploadCV(file);
      onChange([...cvLinks, result]);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      {cvLinks.map((cv, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="shrink-0 text-muted-foreground mt-0.5">
            {isUploadedFile(cv.url) ? (
              <FileText className="size-4" />
            ) : (
              <Link2 className="size-4" />
            )}
          </div>

          <div className="flex-[1_1_120px]">
            {i === 0 && (
              <Label className="text-xs text-muted-foreground block mb-1">
                Name
              </Label>
            )}
            <Input
              placeholder="Main CV"
              value={cv.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
          </div>

          {isUploadedFile(cv.url) ? (
            <div className="flex-[2_1_200px]">
              {i === 0 && <div className="mb-1 text-xs invisible">-</div>}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground px-2 text-[11px]"
                onClick={() => window.open(`${API_BASE_URL}${cv.url}`, "_blank")}
              >
                <ExternalLink className="size-3.5" />
                Preview file
              </Button>
            </div>
          ) : (
            <div className="flex-[2_1_200px]">
              {i === 0 && (
                <Label className="text-xs text-muted-foreground block mb-1">
                  Link
                </Label>
              )}
              <Input
                placeholder="https://drive.google.com/..."
                value={cv.url}
                onChange={(e) => update(i, "url", e.target.value)}
              />
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`shrink-0 text-muted-foreground hover:text-destructive${i === 0 ? " mt-5" : ""}`}
            onClick={() => remove(i)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ))}

      {uploadError && (
        <p className="text-[11px] text-destructive">{uploadError}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload PDF / Word"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={addLink}
        >
          <PlusIcon className="size-3.5" />
          Add link
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        PDF, DOC, DOCX · max 10 MB. Or paste a Google Drive / Dropbox link.
      </p>
    </div>
  );
}
