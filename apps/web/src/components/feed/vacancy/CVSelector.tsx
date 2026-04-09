"use client";

import { useRef } from "react";
import { FileText, Upload, Loader2, Plus } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { CVLink } from "@/types";

interface CVSelectorProps {
  cvLinks: CVLink[];
  selectedCV: CVLink | null;
  onChange: (cv: CVLink | null) => void;
  onUpload?: (file: File) => Promise<CVLink | undefined>;
  uploading?: boolean;
}

export default function CVSelector({
  cvLinks,
  selectedCV,
  onChange,
  onUpload,
  uploading,
}: CVSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    onUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileInputEl = onUpload && (
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,.docx"
      className="hidden"
      onChange={handleFileChange}
    />
  );

  if (cvLinks.length === 0) {
    return (
      <>
        {fileInputEl}
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-center space-y-2">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <FileText className="size-5 text-primary" />
          </div>
          <p className="text-xs font-medium text-foreground">No CVs uploaded yet</p>
          <p className="text-[11px] text-muted-foreground">
            Upload a CV to get match analysis and optimization suggestions
          </p>
          {onUpload && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs mt-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {uploading ? "Uploading..." : "Upload CV"}
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {fileInputEl}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Select CV to analyze</label>
        <div className="flex gap-2">
          <Select
            value={selectedCV?.url}
            onValueChange={(url) => {
              const cv = cvLinks.find((c) => c.url === url) ?? null;
              onChange(cv);
            }}
          >
            <SelectTrigger className="h-9 text-xs flex-1">
              <SelectValue placeholder="Choose a CV..." />
            </SelectTrigger>
            <SelectContent>
              {cvLinks.map((cv) => (
                <SelectItem key={cv.url} value={cv.url}>
                  <span className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    {cv.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onUpload && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-2.5 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload new CV"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
