import * as React from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { CountryOption, LocationValue } from "@/types";

export default function LocationModal({
  value,
  onChange,
  onClose,
  countries,
}: {
  value?: LocationValue;
  onChange?: (v: LocationValue) => void;
  onClose: () => void;
  countries: CountryOption[];
}) {
  const [step, setStep] = React.useState<"first" | "city">("first");
  const [drillCountryVal, setDrillCountryVal] = React.useState<string>("");
  const [firstSearch, setFirstSearch] = React.useState("");
  const [citySearch, setCitySearch] = React.useState("");

  const firstInputRef = React.useRef<HTMLInputElement>(null);
  const cityInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (step === "first") {
        firstInputRef.current?.focus({ preventScroll: true });
      } else {
        cityInputRef.current?.focus({ preventScroll: true });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [step]);

  const drillCountry = countries.find((c) => c.value === drillCountryVal);

  // All selected values — country codes or city values
  const selectedValues: string[] =
    value?.values ?? (value?.value ? [value.value] : []);

  const filteredFirst = React.useMemo(() => {
    const rows = [
      {
        value: "worldwide",
        label: "Worldwide",
        flag: "🌍",
        type: "region" as const,
        hasCities: false,
      },
      ...countries.map((c) => ({
        value: c.value,
        label: c.label,
        flag: c.flag,
        type: "country" as const,
        hasCities: c.cities.length > 0,
      })),
    ];

    const q = firstSearch.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => r.label.toLowerCase().includes(q));
  }, [countries, firstSearch]);

  const filteredCities = React.useMemo(() => {
    if (!drillCountry) return [];
    const q = citySearch.toLowerCase().trim();
    if (!q) return drillCountry.cities;
    return drillCountry.cities.filter((ci) =>
      ci.label.toLowerCase().includes(q),
    );
  }, [drillCountry, citySearch]);

  function cityCountFor(countryVal: string): number {
    const c = countries.find((x) => x.value === countryVal);
    if (!c) return 0;
    return selectedValues.filter((sv) => c.cities.some((ci) => ci.value === sv))
      .length;
  }

  function emitChange(nextValues: string[]) {
    if (nextValues.length === 0) {
      onChange?.({});
    } else if (nextValues.length === 1) {
      // Check if it's a country or city
      const isCountry = countries.some((c) => c.value === nextValues[0]);
      const isWorldwide = nextValues[0] === "worldwide";
      if (isWorldwide) {
        onChange?.({ type: "region", value: "worldwide" });
      } else if (isCountry) {
        onChange?.({ type: "country", value: nextValues[0] });
      } else {
        onChange?.({ type: "city", values: nextValues });
      }
    } else {
      // Mixed: determine type from first item
      const allCities = nextValues.every((v) =>
        countries.some((c) => c.cities.some((ci) => ci.value === v)),
      );
      if (allCities) {
        onChange?.({ type: "city", values: nextValues });
      } else {
        // Countries or mixed — use values array
        onChange?.({ type: "country", values: nextValues });
      }
    }
  }

  function handleFirstRowClick(row: {
    value: string;
    type: "region" | "country";
    hasCities: boolean;
  }) {
    if (row.value === "worldwide") {
      // Worldwide is toggle — select alone
      onChange?.({ type: "region", value: "worldwide" });
      onClose();
      return;
    }

    if (row.hasCities) {
      // Navigate into city picker, but also toggle the country itself
      const current = new Set(selectedValues);
      if (!current.has(row.value)) {
        current.add(row.value);
        emitChange([...current]);
      }
      setDrillCountryVal(row.value);
      setFirstSearch("");
      setCitySearch("");
      setStep("city");
    } else {
      // Country with no cities — toggle it
      const current = new Set(selectedValues);
      if (current.has(row.value)) {
        current.delete(row.value);
      } else {
        current.add(row.value);
      }
      emitChange([...current]);
    }
  }

  function handleCityToggle(cityVal: string) {
    const current = new Set(selectedValues);
    // Remove country itself if selecting a city in that country
    if (drillCountryVal && current.has(drillCountryVal)) {
      current.delete(drillCountryVal);
    }
    if (current.has(cityVal)) {
      current.delete(cityVal);
    } else {
      current.add(cityVal);
    }
    emitChange([...current]);
  }

  function handleBack() {
    setStep("first");
    setCitySearch("");
  }

  const selectedCount = selectedValues.length;

  return (
    <div
      className="relative overflow-hidden w-full flex flex-col"
      style={{ height: 340, backgroundColor: "var(--popover)" }}
    >
      {/* Step 1: Countries */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out bg-popover",
          step === "first" ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-3 border-b border-border/60 shrink-0">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            ref={firstInputRef}
            value={firstSearch}
            onChange={(e) => setFirstSearch(e.target.value)}
            placeholder="Search country..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-sm bg-transparent!"
          />
          {firstSearch && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setFirstSearch("")}
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto p-2 gap-1 min-h-0">
          {filteredFirst.map((row) => {
            const isSelected =
              selectedValues.includes(row.value) ||
              (row.value === "worldwide" && value?.value === "worldwide");
            const count = row.type === "country" ? cityCountFor(row.value) : 0;

            return (
              <Button
                variant="ghost"
                type="button"
                key={row.value}
                onClick={() => handleFirstRowClick(row)}
                className={cn(
                  "w-full justify-start h-8 px-2 py-1.5 font-normal",
                  isSelected && "bg-primary/10 text-primary",
                )}
              >
                {row.flag && (
                  <span className="text-base leading-none shrink-0 mr-2">
                    {row.flag}
                  </span>
                )}
                <span className="flex-1 truncate text-left">{row.label}</span>
                {count > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 shrink-0 leading-none ml-2">
                    {count}
                  </span>
                )}
                {isSelected && !count && (
                  <Check className="size-3.5 shrink-0 ml-2" />
                )}
                {row.hasCities && (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground ml-1" />
                )}
              </Button>
            );
          })}

          {filteredFirst.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No results for &quot;{firstSearch}&quot;
            </p>
          )}
        </div>

        <div className="p-2 border-t border-border/60 shrink-0 flex gap-2 mt-auto bg-popover">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-sm"
            onClick={() => {
              onChange?.({});
            }}
          >
            Clear
          </Button>
          {selectedCount > 0 && (
            <Button
              type="button"
              size="sm"
              className="flex-1 h-8 text-sm"
              onClick={onClose}
            >
              Done — {selectedCount} selected
            </Button>
          )}
        </div>
      </div>

      {/* Step 2: Cities */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out bg-popover",
          step === "city" ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/60 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-7 px-2 gap-1 text-xs"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          {drillCountry && (
            <span className="text-sm font-medium truncate flex-1">
              {drillCountry.flag} {drillCountry.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 border-b border-border/60 shrink-0">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            ref={cityInputRef}
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder="Search city..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-sm bg-transparent!"
          />
          {citySearch && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCitySearch("")}
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto p-2 gap-1 min-h-0">
          {/* "Entire country" option */}
          {drillCountry && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                const current = new Set(selectedValues);
                // Remove all cities of this country
                drillCountry.cities.forEach((ci) => current.delete(ci.value));
                if (current.has(drillCountryVal)) {
                  current.delete(drillCountryVal);
                } else {
                  current.add(drillCountryVal);
                  drillCountry.cities.forEach((ci) => current.delete(ci.value));
                }
                emitChange([...current]);
              }}
              className={cn(
                "w-full justify-start h-8 px-2 py-1.5 font-normal border-b border-border/40 mb-1",
                selectedValues.includes(drillCountryVal) &&
                  "bg-primary/10 text-primary",
              )}
            >
              <Globe className="size-3.5 mr-2 shrink-0" />
              <span className="flex-1 text-left text-sm">
                All cities in {drillCountry.label}
              </span>
              {selectedValues.includes(drillCountryVal) && (
                <Check className="size-3.5 ml-2" />
              )}
            </Button>
          )}

          {filteredCities.map((city) => {
            const isSelected = selectedValues.includes(city.value);
            return (
              <Button
                variant="ghost"
                type="button"
                key={city.value}
                onClick={() => handleCityToggle(city.value)}
                className={cn(
                  "w-full justify-start h-8 px-2 py-1.5 font-normal",
                  isSelected && "bg-primary/10 text-primary",
                )}
              >
                <span className="flex-1 truncate text-left">{city.label}</span>
                {isSelected && <Check className="size-4 shrink-0 ml-2" />}
              </Button>
            );
          })}

          {filteredCities.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No results for &quot;{citySearch}&quot;
            </p>
          )}
        </div>

        <div className="p-2 border-t border-border/60 shrink-0 mt-auto bg-popover">
          <Button
            type="button"
            size="sm"
            className="w-full h-8 text-sm"
            onClick={onClose}
          >
            Done{selectedCount > 0 && ` — ${selectedCount} selected`}
          </Button>
        </div>
      </div>
    </div>
  );
}
