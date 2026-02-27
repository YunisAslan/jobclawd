"use client";

import * as React from "react";
import { MapPin, Globe, ChevronsUpDownIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { ONSITE_COUNTRIES } from "@/lib/data";
import { cn } from "@/lib/utils";
import { LocationValue } from "@/types";

type WorkModeScenario = "remote" | "onsite" | "mixed" | "none";

interface LocationPickerProps {
  value?: LocationValue;
  onChange?: (value: LocationValue) => void;
  workModes?: string[];
}

function getScenario(workModes: string[]): WorkModeScenario {
  const hasRemote = workModes.includes("remote");
  const hasOnsite =
    workModes.includes("onsite") || workModes.includes("hybrid");
  if (hasRemote && hasOnsite) return "mixed";
  if (hasOnsite) return "onsite";
  if (hasRemote) return "remote";
  return "none";
}

function getConfig(scenario: WorkModeScenario) {
  switch (scenario) {
    case "onsite":
    case "mixed":
      return { placeholder: "Country / City", Icon: MapPin };
    default:
      return { placeholder: "Region / Country", Icon: Globe };
  }
}

function getTriggerLabel(value?: LocationValue): string | null {
  if (!value?.value && !value?.values?.length) return null;

  if (value.values?.length) {
    const allCities = ONSITE_COUNTRIES.flatMap((c) => c.cities);
    const labels = value.values
      .map((v) => allCities.find((ci) => ci.value === v)?.label ?? v)
      .join(", ");
    return labels;
  }

  if (!value.value) return null;
  if (value.value === "worldwide") return "Worldwide Remote";
  for (const country of ONSITE_COUNTRIES) {
    if (country.value === value.value) return country.label;
    const city = country.cities.find((ci) => ci.value === value.value);
    if (city) return `${city.label}, ${country.label}`;
  }

  return null;
}

import LocationModal from "./LocationModal";

export default function LocationPicker({
  value,
  onChange,
  workModes = [],
}: LocationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [modalKey, setModalKey] = React.useState(0);

  const scenario = getScenario(workModes);
  const { placeholder, Icon } = getConfig(scenario);
  const triggerLabel = getTriggerLabel(value);

  const prevScenario = React.useRef(scenario);
  React.useEffect(() => {
    if (prevScenario.current !== scenario) {
      prevScenario.current = scenario;
      onChange?.({});
    }
  }, [scenario, onChange]);

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) setModalKey((k) => k + 1);
    setOpen(isOpen);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full h-9 justify-between px-3 font-normal bg-transparent",
            !triggerLabel && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {triggerLabel ? (
              <span className="truncate text-foreground text-sm">
                {triggerLabel}
              </span>
            ) : (
              <span className="truncate text-sm">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-0 shadow-lg border-border/70 overflow-hidden"
        align="start"
        sideOffset={6}
      >
        <LocationModal
          key={modalKey}
          value={value}
          onChange={onChange}
          onClose={handleClose}
          showWorldwide={scenario !== "onsite"}
        />
      </PopoverContent>
    </Popover>
  );
}
