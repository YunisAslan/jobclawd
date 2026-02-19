"use client";

import { CVLink } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { XIcon, PlusIcon } from "lucide-react";

interface CVLinkManagerProps {
  cvLinks: CVLink[];
  onChange: (links: CVLink[]) => void;
}

export default function CVLinkManager({ cvLinks, onChange }: CVLinkManagerProps) {
  const update = (index: number, field: keyof CVLink, value: string) =>
    onChange(cvLinks.map((cv, i) => (i === index ? { ...cv, [field]: value } : cv)));

  const remove = (index: number) => onChange(cvLinks.filter((_, i) => i !== index));

  const add = () => onChange([...cvLinks, { name: "", url: "" }]);

  return (
    <div className="space-y-3">
      {cvLinks.map((cv, i) => (
        <div key={i} className="flex gap-2 items-end">
          <div className="space-y-1 flex-[1_1_120px]">
            {i === 0 && <Label className="text-xs text-muted-foreground">Name</Label>}
            <Input
              placeholder="Main CV"
              value={cv.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
          </div>
          <div className="space-y-1 flex-[2_1_200px]">
            {i === 0 && <Label className="text-xs text-muted-foreground">Link</Label>}
            <Input
              placeholder="https://drive.google.com/..."
              value={cv.url}
              onChange={(e) => update(i, "url", e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(i)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={add}
      >
        <PlusIcon className="size-4" />
        Add CV
      </Button>
    </div>
  );
}
