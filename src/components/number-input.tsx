import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "step"> & {
  label?: string;
  suffix?: string;
  /** Wenn gesetzt: Stepper-Buttons einblenden, die den Wert um `step` erhöhen/verringern. */
  step?: number;
  /** Nur Ganzzahlen zulassen → numerische Tastatur ohne Komma. Default: true wenn `step` integer ist. */
  integer?: boolean;
  min?: number;
  max?: number;
};

function parseNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export const NumberInput = React.forwardRef<HTMLInputElement, Props>(function NumberInput(
  { label, suffix, className, step, integer, min, max, onChange, value, ...rest },
  ref,
) {
  const innerRef = React.useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  const isInteger = integer ?? (step != null && Number.isInteger(step));
  const hasStepper = typeof step === "number" && step > 0;

  const nudge = (dir: 1 | -1) => {
    if (!hasStepper) return;
    const current = parseNum(value) ?? parseNum(innerRef.current?.value) ?? 0;
    let next = current + dir * step!;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    if (isInteger) next = Math.round(next);
    // Synthetic change event, damit `onChange` wie beim Tippen ausgelöst wird.
    const el = innerRef.current;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(el, String(next));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
      )}
      <div className="relative flex items-stretch">
        {hasStepper && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label={`Minus ${step}`}
            className="min-h-[52px] w-12 shrink-0 border border-r-0 border-[var(--color-hairline)] bg-[var(--color-sand)] text-[var(--color-ink)] active:bg-[var(--color-sand-deep)] flex items-center justify-center"
          >
            <Minus className="size-5" strokeWidth={2} />
          </button>
        )}
        <div className="relative flex-1">
          <input
            ref={setRef}
            inputMode={isInteger ? "numeric" : "decimal"}
            pattern={isInteger ? "[0-9]*" : "[0-9.,]*"}
            value={value}
            onChange={onChange}
            className={cn(
              "min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[22px] font-serif tabular-nums focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none",
              hasStepper && "text-center",
              suffix && !hasStepper && "pr-14",
              suffix && hasStepper && "pr-12",
              className,
            )}
            {...rest}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] font-medium text-[var(--color-stone-muted)]">
              {suffix}
            </span>
          )}
        </div>
        {hasStepper && (
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label={`Plus ${step}`}
            className="min-h-[52px] w-12 shrink-0 border border-l-0 border-[var(--color-hairline)] bg-[var(--color-sand)] text-[var(--color-ink)] active:bg-[var(--color-sand-deep)] flex items-center justify-center"
          >
            <Plus className="size-5" strokeWidth={2} />
          </button>
        )}
      </div>
    </label>
  );
});
