import * as React from "react";
import { Search, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ONSITE_COUNTRIES } from "@/lib/data";
import { cn } from "@/lib/utils";
import { LocationValue } from "@/types";

export default function LocationModal({
  value,
  onChange,
  onClose,
  showWorldwide,
}: {
  value?: LocationValue;
  onChange?: (v: LocationValue) => void;
  onClose: () => void;
  showWorldwide: boolean;
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

  const drillCountry = ONSITE_COUNTRIES.find(
    (c) => c.value === drillCountryVal,
  );

  const firstList = React.useMemo(() => {
    type Row = {
      value: string;
      label: string;
      flag?: string;
      type: "region" | "country" | "city";
      hasCities: boolean;
    };
    const rows: Row[] = [];

    if (showWorldwide) {
      rows.push({
        value: "worldwide",
        label: "Worldwide Remote",
        flag: "🌍",
        type: "region",
        hasCities: false,
      });
    }

    for (const c of ONSITE_COUNTRIES) {
      rows.push({
        value: c.value,
        label: c.label,
        flag: c.flag,
        type: "country",
        hasCities: c.cities.length > 0,
      });
    }

    return rows;
  }, [showWorldwide]);

  const filteredFirst = React.useMemo(() => {
    const q = firstSearch.toLowerCase().trim();
    if (!q) return firstList;
    return firstList.filter((r) => r.label.toLowerCase().includes(q));
  }, [firstList, firstSearch]);

  const filteredCities = React.useMemo(() => {
    if (!drillCountry) return [];
    const q = citySearch.toLowerCase().trim();
    if (!q) return drillCountry.cities;
    return drillCountry.cities.filter((ci) =>
      ci.label.toLowerCase().includes(q),
    );
  }, [drillCountry, citySearch]);

  const selectedCities: string[] = value?.values ?? [];

  function cityCountFor(countryVal: string): number {
    const c = ONSITE_COUNTRIES.find((x) => x.value === countryVal);
    if (!c) return 0;
    return selectedCities.filter((sv) => c.cities.some((ci) => ci.value === sv))
      .length;
  }

  function handleFirstRowClick(row: {
    value: string;
    type: "region" | "country" | "city";
    hasCities: boolean;
  }) {
    if (row.value === "worldwide") {
      onChange?.({ type: "region", value: "worldwide" });
      onClose();
      return;
    }
    if (row.type === "region") {
      onChange?.({ type: "region", value: row.value });
      onClose();
      return;
    }
    if (row.hasCities) {
      setDrillCountryVal(row.value);
      setFirstSearch("");
      setCitySearch("");
      setStep("city");
    } else {
      onChange?.({ type: "country", value: row.value });
      onClose();
    }
  }

  function handleCityToggle(cityVal: string) {
    const current = new Set(selectedCities);
    if (current.has(cityVal)) current.delete(cityVal);
    else current.add(cityVal);
    const next = [...current];
    if (next.length === 0) {
      onChange?.({ type: "country", value: drillCountryVal });
    } else {
      onChange?.({ type: "city", values: next });
    }
  }

  function handleBack() {
    setStep("first");
    setCitySearch("");
  }

  const v = value?.value;
  const cCount = value?.values?.length;

  React.useEffect(() => {}, [v, cCount]);

  const selectedCityCount = selectedCities.length;

  return (
    <div
      className="relative overflow-hidden w-full flex flex-col"
      style={{ height: 320, backgroundColor: "var(--popover)" }}
    >
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
            placeholder="Search..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-sm bg-transparent"
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
              value?.value === row.value && !value?.values?.length;
            const count = row.type === "country" ? cityCountFor(row.value) : 0;

            return (
              <Button
                variant="ghost"
                type="button"
                key={row.value}
                onClick={() => handleFirstRowClick(row)}
                className="w-full justify-start h-8 px-2 py-1.5 font-normal"
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
                {row.hasCities && !isSelected && (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground ml-2" />
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

        <div className="p-2 border-t border-border/60 shrink-0 mt-auto bg-popover">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 text-sm"
            onClick={() => {
              onChange?.({});
              onClose();
            }}
          >
            Clear
          </Button>
        </div>
      </div>

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
        </div>

        <div className="flex items-center gap-2 px-3 border-b border-border/60 shrink-0">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            ref={cityInputRef}
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder="Search city..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-sm bg-transparent"
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
          {filteredCities.map((city) => {
            const isSelected = selectedCities.includes(city.value);
            return (
              <Button
                variant="ghost"
                type="button"
                key={city.value}
                onClick={() => handleCityToggle(city.value)}
                className="w-full justify-start h-8 px-2 py-1.5 font-normal"
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
            Done{" "}
            {selectedCityCount > 0 &&
              `— ${selectedCityCount} ${selectedCityCount === 1 ? "city" : "cities"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
