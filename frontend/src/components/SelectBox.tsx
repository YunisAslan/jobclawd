import {
  Select,
  SelectContent,
  SelectItem,
  SelectMode,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

type SelectBoxBaseProps = {
  icon?: React.ReactNode;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  search?: boolean | { placeholder?: string; emptyMessage?: string };
  disabled?: boolean;
};

type SelectBoxSingleProps = SelectBoxBaseProps & {
  mode?: "single";
  value?: string;
  onChange?: (value: string) => void;
};

type SelectBoxMultiProps = SelectBoxBaseProps & {
  mode: "multiple";
  value?: string[];
  onChange?: (value: string[]) => void;
};

type SelectBoxProps = SelectBoxSingleProps | SelectBoxMultiProps;

function SelectBox({
  icon,
  options,
  placeholder,
  mode = "single",
  value,
  onChange,
  search,
  disabled,
}: SelectBoxProps) {
  const isMultiple = mode === "multiple";
  return (
    <Select
      disabled={disabled}
      mode={mode as SelectMode}
      value={!isMultiple ? (value as string) : undefined}
      values={isMultiple ? (value as string[]) : undefined}
      onValueChange={
        !isMultiple ? (onChange as (v: string) => void) : undefined
      }
      onValuesChange={
        isMultiple ? (onChange as (v: string[]) => void) : undefined
      }
    >
      <SelectTrigger className="w-full">
        {icon ? icon : null}
        <SelectValue placeholder={placeholder} overflowBehavior="cutoff" />
      </SelectTrigger>
      <SelectContent position="popper" search={search}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SelectBox;
