"use client";

import * as React from "react";
import { MapPin, Globe, ChevronsUpDownIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CountryOption, LocationValue } from "@/types";
import LocationModal from "./LocationModal";

interface LocationPickerProps {
  value?: LocationValue;
  onChange?: (value: LocationValue) => void;
  countries?: CountryOption[];
  disabled?: boolean;
}

function getTriggerLabel(
  value?: LocationValue,
  countries?: CountryOption[],
): string | null {
  if (!value?.value && !value?.values?.length) return null;

  if (value.values?.length) {
    const allCities = (countries || []).flatMap((c) => c.cities);
    const labels = value.values
      .map((v) => {
        const city = allCities.find((ci) => ci.value === v);
        if (city) return city.label;
        const country = (countries || []).find((c) => c.value === v);
        if (country) return country.label;
        return v;
      })
      .join(", ");
    return labels;
  }

  if (!value.value) return null;
  if (value.value === "worldwide") return "Worldwide";
  for (const country of countries || []) {
    if (country.value === value.value) return country.label;
    const city = country.cities.find((ci) => ci.value === value.value);
    if (city) return `${city.label}, ${country.label}`;
  }

  return null;
}

export default function LocationPicker({
  value,
  onChange,
  countries = [],
  disabled,
}: LocationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [modalKey, setModalKey] = React.useState(0);

  const triggerLabel = getTriggerLabel(value, countries);

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
          disabled={disabled}
          className={cn(
            "w-full h-9 justify-between px-3 font-normal bg-transparent",
            !triggerLabel && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            {triggerLabel ? (
              <span className="truncate text-foreground text-sm">
                {triggerLabel}
              </span>
            ) : (
              <span className="truncate text-sm">Country / City</span>
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
          countries={countries}
        />
      </PopoverContent>
    </Popover>
  );
}
