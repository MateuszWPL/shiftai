"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  onValueChange?: (value: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, min = 0, max = 10, step = 1, value, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value ?? min);

    const currentValue = value !== undefined ? value : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value);
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    };

    const percentage = ((currentValue - min) / (max - min)) * 100;

    return (
      <div className={cn("relative flex w-full items-center", className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
          style={{
            background: `linear-gradient(to right, #171717 0%, #171717 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
          }}
          {...props}
        />
        <div className="absolute -top-6 left-0 text-xs text-gray-500 dark:text-gray-400">
          {min}
        </div>
        <div className="absolute -top-6 right-0 text-xs text-gray-500 dark:text-gray-400">
          {max}
        </div>
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
