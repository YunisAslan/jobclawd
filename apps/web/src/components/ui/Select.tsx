"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/Command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

export type SelectMode = "single" | "multiple";

type SelectContextType = {
  mode: SelectMode;
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedValues: Set<string>;
  toggleValue: (value: string) => void;
  items: Map<string, React.ReactNode>;
  onItemAdded: (value: string, label: React.ReactNode) => void;
  disabled?: boolean;
};
const SelectContext = React.createContext<SelectContextType | null>(null);

function useSelectContext() {
  const context = React.useContext(SelectContext);
  if (context == null) {
    throw new Error("useSelectContext must be used within a Select component");
  }
  return context;
}

interface SelectProps {
  children: React.ReactNode;
  mode?: SelectMode;
  value?: string;
  defaultValue?: string;
  values?: string[];
  defaultValues?: string[];
  onValueChange?: (value: string) => void;
  onValuesChange?: (values: string[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  options?: Array<{ value: string; label: string | React.ReactNode }>;
}

function Select({
  children,
  mode = "single",
  value,
  defaultValue,
  values,
  defaultValues,
  onValueChange,
  onValuesChange,
  open: controlledOpen,
  onOpenChange,
  disabled,
  options,
}: SelectProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const getInitialValues = (): string[] => {
    if (mode === "single") {
      const v = value ?? defaultValue;
      return v ? [v] : [];
    }
    return values ?? defaultValues ?? [];
  };

  const [internalValues, setInternalValues] = React.useState<Set<string>>(
    () => new Set(getInitialValues()),
  );

  const selectedValues =
    mode === "single"
      ? value !== undefined
        ? new Set(value ? [value] : [])
        : internalValues
      : values
        ? new Set(values)
        : internalValues;

  const [items, setItems] = React.useState<Map<string, React.ReactNode>>(() => {
    const m = new Map<string, React.ReactNode>();
    options?.forEach((opt) => m.set(opt.value, opt.label));
    return m;
  });

  React.useEffect(() => {
    if (options && options.length > 0) {
      setItems((prev) => {
        const next = new Map(prev);
        options.forEach((opt) => next.set(opt.value, opt.label));
        return next;
      });
    }
  }, [options]);

  function toggleValue(newValue: string) {
    if (mode === "single") {
      const newVal = selectedValues.has(newValue) ? "" : newValue;
      setInternalValues(new Set(newVal ? [newVal] : []));
      onValueChange?.(newVal);
      setOpen(false);
    } else {
      const getNewSet = (prev: Set<string>) => {
        const newSet = new Set(prev);
        if (newSet.has(newValue)) {
          newSet.delete(newValue);
        } else {
          newSet.add(newValue);
        }
        return newSet;
      };
      setInternalValues(getNewSet);
      onValuesChange?.([...getNewSet(selectedValues)]);
    }
  }

  const onItemAdded = React.useCallback((value: string, label: React.ReactNode) => {
    setItems((prev) => {
      if (prev.get(value) === label) return prev;
      return new Map(prev).set(value, label);
    });
  }, []);

  return (
    <SelectContext
      value={{
        mode,
        open,
        setOpen,
        selectedValues,
        toggleValue,
        items,
        onItemAdded,
        disabled,
      }}
    >
      {mode === "single" ? (
        <SelectPrimitive.Root
          open={open}
          onOpenChange={setOpen}
          value={[...selectedValues][0] || undefined}
          onValueChange={toggleValue}
        >
          {children}
        </SelectPrimitive.Root>
      ) : (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
          {children}
        </Popover>
      )}
    </SelectContext>
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  disabled: disabledProp,
  variant = "outline",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { mode, open, disabled, selectedValues, toggleValue } = useSelectContext();
  const isDisabled = disabledProp ?? disabled;

  if (mode === "multiple") {
    return (
      <PopoverTrigger asChild disabled={isDisabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={isDisabled}
          className={cn(
            // Match single-select trigger look exactly
            "hover:bg-accent cursor-pointer border-input data-placeholder:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
            className,
          )}
        >
          <div className="flex flex-1 min-w-0 items-center gap-2 overflow-hidden">{children}</div>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
    );
  }

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      disabled={isDisabled}
      className={cn(
        "hover:bg-accent cursor-pointer border-input data-placeholder:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">{children}</div>
      <SelectPrimitive.Icon asChild>
        {mode === "single" && selectedValues.size > 0 ? (
          <div
            role="button"
            tabIndex={0}
            className="flex items-center justify-center p-0.5 rounded-full cursor-pointer text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors pointer-events-auto"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const val = [...selectedValues][0];
              if (val) toggleValue(val);
            }}
          >
            <XIcon className="size-4" />
          </div>
        ) : (
          <ChevronDownIcon className="size-4 opacity-50" />
        )}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({
  className,
  overflowBehavior = "wrap-when-open",
  placeholder,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Value>, "placeholder"> & {
  placeholder?: string;
  overflowBehavior?: "wrap" | "wrap-when-open" | "cutoff";
}) {
  const { mode, selectedValues, items, open, toggleValue } = useSelectContext();
  const [overflowAmount, setOverflowAmount] = React.useState(0);
  const valueRef = React.useRef<HTMLDivElement>(null);
  const overflowRef = React.useRef<HTMLDivElement>(null);

  const currentValue = [...selectedValues][0];

  if (mode === "single") {
    if (!currentValue && placeholder) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }
    return <span>{items.get(currentValue) || currentValue}</span>;
  }

  const checkOverflow = React.useCallback(() => {
    if (valueRef.current == null) return;

    const containerElement = valueRef.current;
    const overflowElement = overflowRef.current;
    const selectedItems = containerElement.querySelectorAll<HTMLElement>("[data-selected-item]");

    if (overflowElement != null) overflowElement.style.display = "none";
    selectedItems.forEach((child) => child.style.removeProperty("display"));
    let amount = 0;
    for (let i = selectedItems.length - 1; i >= 0; i--) {
      const child = selectedItems[i]!;
      if (containerElement.scrollWidth <= containerElement.clientWidth) {
        break;
      }
      amount = selectedItems.length - i;
      child.style.display = "none";
      overflowElement?.style.removeProperty("display");
    }
    setOverflowAmount(amount);
  }, []);

  const handleResize = React.useCallback(
    (node: HTMLDivElement) => {
      valueRef.current = node;

      const mutationObserver = new MutationObserver(checkOverflow);
      const observer = new ResizeObserver(debounce(checkOverflow, 100));

      mutationObserver.observe(node, {
        childList: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });
      observer.observe(node);

      return () => {
        observer.disconnect();
        mutationObserver.disconnect();
        valueRef.current = null;
      };
    },
    [checkOverflow],
  );

  if (selectedValues.size === 0 && placeholder) {
    return (
      <span className="min-w-0 overflow-hidden font-normal text-muted-foreground">
        {placeholder}
      </span>
    );
  }

  const shouldWrap = overflowBehavior === "wrap" || (overflowBehavior === "wrap-when-open" && open);

  return (
    <div
      ref={handleResize}
      className={cn(
        "flex w-full gap-1.5 overflow-hidden",
        shouldWrap && "h-full flex-wrap",
        className,
      )}
    >
      {[...selectedValues].map((value) => (
        <Badge
          variant="outline"
          data-selected-item
          className="group flex items-center gap-1 bg-accent/80"
          key={value}
          onClick={(e) => {
            e.stopPropagation();
            toggleValue(value);
          }}
        >
          {items.get(value) || value}
          <XIcon className="size-2 text-muted-foreground group-hover:text-destructive" />
        </Badge>
      ))}
      <Badge
        style={{
          display: overflowAmount > 0 && !shouldWrap ? "block" : "none",
        }}
        variant="outline"
        ref={overflowRef}
      >
        +{overflowAmount}
      </Badge>
    </div>
  );
}

function SelectContent({
  className,
  children,
  search = true,
  position = "item-aligned",
  align = "center",
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Content>, "position" | "align"> & {
  search?: boolean | { placeholder?: string; emptyMessage?: string };
  children: React.ReactNode;
  position?: "item-aligned" | "popper";
  align?: "start" | "center" | "end";
}) {
  const { mode } = useSelectContext();

  if (mode === "multiple") {
    const canSearch = typeof search === "object" ? true : search;

    return (
      <PopoverContent className="min-w-(--radix-popover-trigger-width) p-0 w-auto">
        <Command>
          {canSearch ? (
            <CommandInput
              placeholder={typeof search === "object" ? search.placeholder : undefined}
            />
          ) : (
            <button autoFocus className="sr-only" />
          )}
          <CommandList className="p-1">
            {canSearch && (
              <CommandEmpty>
                {typeof search === "object" ? search.emptyMessage : undefined}
              </CommandEmpty>
            )}
            {children}
          </CommandList>
        </Command>
      </PopoverContent>
    );
  }

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-state:open:animate-in data-state:closed:animate-out data-state:closed:fade-out-0 data-state:open:fade-in-0 data-state:closed:zoom-out-95 data-state:open:zoom-in-95 data-side:bottom:slide-in-from-top-2 data-side:left:slide-in-from-right-2 data-side:right:slide-in-from-left-2 data-side:top:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-side:bottom:translate-y-1 data-side:left:-translate-x-1 data-side:right:translate-x-1 data-side:top:-translate-y-1",
          className,
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width) scroll-my-1",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  badgeLabel,
  value,
  onSelect,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Item>, "onSelect"> & {
  badgeLabel?: React.ReactNode;
  onSelect?: (value: string) => void;
}) {
  const { mode, toggleValue, selectedValues, onItemAdded } = useSelectContext();
  const isSelected = selectedValues.has(value);

  React.useEffect(() => {
    onItemAdded(value, badgeLabel ?? children ?? value);
  }, [value, children, onItemAdded, badgeLabel]);

  if (mode === "single") {
    return (
      <SelectPrimitive.Item
        data-slot="select-item"
        className={cn(
          "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
          className,
        )}
        value={value}
        onSelect={() => {
          toggleValue(value);
          onSelect?.(value);
        }}
        {...props}
      >
        <span
          data-slot="select-item-indicator"
          className="absolute right-2 flex size-3.5 items-center justify-center"
        >
          <SelectPrimitive.ItemIndicator>
            <CheckIcon className="size-4" />
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }

  return (
    <CommandItem
      onSelect={() => {
        toggleValue(value);
        onSelect?.(value);
      }}
    >
      {children}

      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <CheckIcon className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")} />
      </span>
    </CommandItem>
  );
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  const { mode } = useSelectContext();

  if (mode === "multiple") {
    return <CommandGroup {...props} />;
  }

  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  const { mode } = useSelectContext();

  if (mode === "multiple") {
    return (
      <CommandGroup heading={props.children as string}>
        <span className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}>
          {props.children}
        </span>
      </CommandGroup>
    );
  }

  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  const { mode } = useSelectContext();

  if (mode === "multiple") {
    return <CommandSeparator {...props} />;
  }

  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
