import {
  Select,
  SelectContent,
  SelectItem,
  SelectMode,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface SelectBoxProps {
  icon?: React.ReactNode;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  mode?: SelectMode;
}

function SelectBox({
  icon,
  options,
  placeholder,
  mode = "single",
}: SelectBoxProps) {
  return (
    <Select mode={mode} >
      <SelectTrigger className="w-full">
        {icon ? icon : null}
        <SelectValue placeholder={placeholder} overflowBehavior="cutoff"/>
      </SelectTrigger>
      <SelectContent position="popper">
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
