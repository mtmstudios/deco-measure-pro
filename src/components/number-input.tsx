import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  suffix?: string;
};

export const NumberInput = React.forwardRef<HTMLInputElement, Props>(function NumberInput(
  { label, suffix, className, ...rest },
  ref,
) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
      )}
      <div className="relative">
        <input
          ref={ref}
          inputMode="numeric"
          pattern="[0-9]*"
          className={cn(
            "h-14 w-full rounded-lg border border-input bg-card px-4 text-2xl font-medium tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            suffix && "pr-14",
            className,
          )}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
});
