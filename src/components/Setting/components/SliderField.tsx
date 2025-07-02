import React from "react";
import { FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleHelp } from "lucide-react";

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  tooltip?: string;
  showValue?: boolean;
  showInput?: boolean;
  className?: string;
}

const HelpTip: React.FC<{ children: React.ReactNode; tip: string }> = ({ children, tip }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 cursor-help">
          {children}
          <CircleHelp className="h-3 w-3 text-muted-foreground" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const SliderField: React.FC<SliderFieldProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  tooltip,
  showValue = true,
  showInput = false,
  className = "",
}) => {
  const handleSliderChange = (values: number[]) => {
    onChange(values[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(Math.max(min, Math.min(max, newValue)));
    }
  };

  const renderLabel = () => {
    if (tooltip) {
      return (
        <HelpTip tip={tooltip}>
          {label}
        </HelpTip>
      );
    }
    return label;
  };

  return (
    <FormItem className={`from-item ${className}`}>
      <FormLabel className="from-label">
        {renderLabel()}
      </FormLabel>
      <FormControl className="form-field">
        <div className="flex h-9 items-center">
          <Slider
            className={showInput ? "w-10/12" : "flex-1"}
            value={[value]}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onValueChange={handleSliderChange}
          />
          {showInput && (
            <Input
              className="ml-4 w-2/12"
              type="number"
              value={value}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              onChange={handleInputChange}
            />
          )}
          {showValue && !showInput && (
            <span className="w-[14%] text-center text-sm leading-10">
              {value}
            </span>
          )}
        </div>
      </FormControl>
    </FormItem>
  );
};

export default SliderField;