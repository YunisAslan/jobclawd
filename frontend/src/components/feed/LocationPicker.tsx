"use client";

import * as React from "react";
import { MapPin, Search, Globe, ChevronsUpDownIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  REMOTE_LOCATION_GROUPS,
  ONSITE_LOCATION_GROUPS,
  MIXED_LOCATION_GROUPS,
  LocationZone,
  LocationGroup,
} from "@/lib/data";
import { cn } from "@/lib/utils";

interface LocationPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  workModes?: string[];
}

function resolveGroups(workModes: string[]): {
  groups: LocationGroup[];
  placeholder: string;
  Icon: React.ElementType;
} {
  const hasRemote = workModes.includes("remote");
  const hasOnsite =
    workModes.includes("onsite") || workModes.includes("hybrid");

  if (hasRemote && hasOnsite) {
    return { groups: MIXED_LOCATION_GROUPS, placeholder: "City", Icon: MapPin };
  }
  if (hasOnsite) {
    return {
      groups: ONSITE_LOCATION_GROUPS,
      placeholder: "City",
      Icon: MapPin,
    };
  }
  return {
    groups: REMOTE_LOCATION_GROUPS,
    placeholder: "Region / Country",
    Icon: Globe,
  };
}

export default function LocationPicker({
  value,
  onChange,
  workModes = [],
}: LocationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const { groups, placeholder, Icon } = resolveGroups(workModes);

  React.useEffect(() => {
    if (!value) return;
    const allItems = groups.flatMap((g) => g.items);
    if (!allItems.find((item) => item.value === value)) {
      onChange?.("");
    }
  }, [groups, value, onChange]);

  const selected = React.useMemo(() => {
    for (const group of groups) {
      const found = group.items.find((item) => item.value === value);
      if (found) return found;
    }
    return null;
  }, [value, groups]);

  const filteredGroups = React.useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [search, groups]);

  function handleSelect(zone: LocationZone) {
    onChange?.(zone.value === value ? "" : zone.value);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-9 justify-between px-3 font-normal bg-transparent",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {selected ? (
              <>
                <span className="text-base leading-none">{selected.flag}</span>
                <span className="truncate text-foreground">
                  {selected.label}
                </span>
              </>
            ) : (
              <>
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{placeholder}</span>
              </>
            )}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 shadow-lg border-border/70 overflow-hidden"
        align="start"
        sideOffset={6}
      >
        {/* Search */}
        <div className="flex items-center gap-2 px-3 border-b border-border/60">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search manually..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-sm bg-transparent"
          />
        </div>

        {/* Groups */}
        <div className="p-2 space-y-3 max-h-72 overflow-y-auto">
          {filteredGroups.map((group) => (
            <div key={group.heading}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1.5">
                {group.heading}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.items.map((zone) => {
                  const isSelected = value === zone.value;
                  return (
                    <Button
                      key={zone.value}
                      variant={isSelected ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleSelect(zone)}
                      className={cn(
                        "justify-start gap-2 h-auto py-2 px-3 text-sm font-normal",
                        zone.fullWidth && "col-span-2",
                        !isSelected && "bg-muted/50 hover:bg-muted",
                      )}
                    >
                      <span className="text-base leading-none">
                        {zone.flag}
                      </span>
                      <span className="truncate">{zone.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No results for &quot;{search}&quot;
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
