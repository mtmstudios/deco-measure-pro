import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { AppLogo } from "@/components/app-logo";

type Props = {
  /** Wenn gesetzt, zeigt das linke Slot einen Zurück-Pfeil zu diesem Pfad. */
  backTo?: string;
  backParams?: Record<string, string>;
  /** Optionaler Inhalt im rechten Slot (z.B. primärer Aktions-Button). */
  right?: ReactNode;
  /** Optionale zweite Zeile mit Titel + Eyebrow direkt unter dem Header. */
  title?: ReactNode;
  eyebrow?: ReactNode;
  /** Optional zusätzliche Zeile (z.B. Progress-Bar) unter dem Header. */
  below?: ReactNode;
};

export function ScreenHeader({ backTo, backParams, right, title, eyebrow, below }: Props) {
  return (
    <header
      className="sticky top-0 z-10 bg-[var(--color-paper)] border-b border-[var(--color-hairline)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8">
        <div className="h-14 md:h-16 grid grid-cols-[52px_1fr_auto] items-center gap-2">
          <div className="flex items-center">
            {backTo ? (
              <Link
                to={backTo as never}
                params={backParams as never}
                aria-label="Zurück"
                className="size-11 -ml-2 flex items-center justify-center text-[var(--color-ink)] hover:text-[var(--color-brand)]"
              >
                <ArrowLeft className="size-5" strokeWidth={1.75} />
              </Link>
            ) : (
              <span aria-hidden className="size-11" />
            )}
          </div>
          <div className="flex justify-center">
            <Link to="/projekte" aria-label="Zur Projektliste" className="inline-flex">
              <AppLogo height={26} />
            </Link>
          </div>
          <div className="flex items-center justify-end min-h-11">{right}</div>
        </div>
        {(title || eyebrow) && (
          <div className="pt-1 pb-4">
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && (
              <h1 className="text-[26px] md:text-[30px] leading-tight font-serif font-medium">
                {title}
              </h1>
            )}
          </div>
        )}
        {below && <div className="pb-3">{below}</div>}
      </div>
    </header>
  );
}
