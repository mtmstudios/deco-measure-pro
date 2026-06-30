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
          inputMode="decimal"
          pattern="[0-9.,]*"
          className={cn(
            "min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[22px] font-serif tabular-nums focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none",
            suffix && "pr-14",
            className,
          )}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-medium text-[var(--color-stone-muted)]">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
});
