import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
    onValueChange?: (value: number[]) => void
    max?: number
    min?: number
    step?: number
    value?: number[]
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, min = 0, max = 100, step = 1, value, onValueChange, ...props }, ref) => {
        const val = value ? value[0] : 0;

        return (
            <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 accent-primary"
                    ref={ref}
                    {...props}
                />
            </div>
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
