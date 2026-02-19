"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { XIcon, PlusIcon } from "lucide-react";

interface BlacklistManagerProps {
  blacklist: string[];
  onChange: (list: string[]) => void;
}

export default function BlacklistManager({ blacklist, onChange }: BlacklistManagerProps) {
  const update = (index: number, value: string) =>
    onChange(blacklist.map((v, i) => (i === index ? value : v)));

  const remove = (index: number) => onChange(blacklist.filter((_, i) => i !== index));

  const add = () => onChange([...blacklist, ""]);

  return (
    <div className="space-y-2">
      {blacklist.map((company, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Company name"
            value={company}
            onChange={(e) => update(i, e.target.value)}
          />
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
        Add company
      </Button>
    </div>
  );
}
