import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildEngineProjekt } from "@/lib/build-engine-projekt";
import { buildGeoProjekt } from "@/lib/build-geo-projekt";
import { generateAufmassZeilen, zeilenToXlsx } from "@/lib/raumlevel-export";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/screen-header";
import { AppLogo } from "@/components/app-logo";
import {
  AlertOctagon,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projekt/$id/vorschau")({
  head: () => ({ meta: [{ title: "Vorschau & Übergabe" }] }),
  component: Vorschau,
});

type Zeile = { raum: string; formel: string; ergebnis: number };
type Position = {
  leistungs_code: string;
  name: string;
  einheit: string;
  zeilen: Zeile[];
  endsumme: number;
};
type ProjektMeta = {
  kunde: string | null;
  objekt_bezeichnung: string | null;
  auftrag_nr: string | null;
  gewerk: string | null;
  adresse?: string | null;
};
type Befund = { schwere: "block" | "warnung"; code: string; raum?: string; message: string };
type Antwort = {
  uebergabe: {
    schema_version: string;
    projekt: ProjektMeta;
    positionen: Position[];
    kennzahlen?: any[];
  };
  befunde: Befund[];
  blocker: boolean;
};

const ease = "cubic-bezier(0.16,1,0.3,1)";
const de = (n: number, frac = 2) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: frac, maximumFractionDigits: frac });

function Vorschau() {
  const { id } = Route.useParams();

  const { data, isLoading, error, refetch, isFetching } = useQuery<Antwort>({
    queryKey: ["vorschau", id],
    queryFn: async () => {
      const engine = await buildEngineProjekt(id);
      const { data, error } = await supabase.functions.invoke("generate-positionen", {
        body: { projekt: engine },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as Antwort;
    },
  });

  // Adresse zusätzlich nachladen für den Branding-Kopf
  const { data: projektExtra } = useQuery({
    queryKey: ["projekt-meta", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("projekt" as never)
        .select("adresse")
        .eq("id", id)
        .maybeSingle();
      return data as unknown as { adresse: string | null } | null;
    },
  });

  const befunde = data?.befunde ?? [];
  const blocker = befunde.filter((b) => b.schwere === "block");
  const warnungen = befunde.filter((b) => b.schwere === "warnung");
  const projekt: ProjektMeta | undefined = data?.uebergabe.projekt
    ? { ...data.uebergabe.projekt, adresse: projektExtra?.adresse ?? null }
    : undefined;

  return (
    <>
      <div className="myr-rise pb-[260px]">
        <ScreenHeader
          backTo="/projekt/$id"
          backParams={{ id }}
          right={
            isFetching ? (
              <Loader2 className="size-4 animate-spin text-[var(--color-stone-muted)]" />
            ) : undefined
          }
        />

        <div className="mx-auto max-w-[960px] px-4 md:px-6 lg:px-8 pt-2 space-y-6">
          <BrandingKopf projekt={projekt} />

          <h1 className="font-serif text-[26px] md:text-[30px] leading-tight font-medium">
            Vorschau
          </h1>

          {isLoading ? (
            <div className="text-center py-12 text-[var(--color-stone-muted)]">
              Berechne Positionen…
            </div>
          ) : error ? (
            <div className="myr-card p-5 space-y-3">
              <p className="font-serif text-[18px] text-[var(--color-danger)]">
                Fehler bei der Berechnung
              </p>
              <p className="text-[14px] text-[var(--color-stone-muted)]">
                {(error as Error).message}
              </p>
              <Button
                className="min-h-[44px] rounded-none bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[12px]"
                onClick={() => refetch()}
              >
                Erneut versuchen
              </Button>
            </div>
          ) : data ? (
            <>
              <BefundLeiste blocker={blocker} warnungen={warnungen} />
              <PositionenListe positionen={data.uebergabe.positionen} />
            </>
          ) : null}
        </div>
      </div>

      {data && projekt && (
        <FooterActions
          projektId={id}
          antwort={data}
          projekt={projekt}
          hasBlocker={data.blocker}
        />
      )}
    </>
  );
}

function BrandingKopf({ projekt }: { projekt?: ProjektMeta }) {
  return (
    <section className="pt-2 pb-2">
      <p className="eyebrow">Aufmaßprotokoll</p>
      <h2 className="font-serif text-[22px] md:text-[26px] leading-tight mt-2 text-[var(--color-ink)]">
        {projekt?.objekt_bezeichnung ?? "—"}
      </h2>
      <div className="mt-1 text-[14px] text-[var(--color-stone-muted)] space-y-0.5">
        {projekt?.kunde && <p>{projekt.kunde}</p>}
        {projekt?.adresse && <p>{projekt.adresse}</p>}
        {projekt?.auftrag_nr && <p>Auftrag {projekt.auftrag_nr}</p>}
      </div>
    </section>
  );
}

function BefundLeiste({
  blocker,
  warnungen,
}: {
  blocker: Befund[];
  warnungen: Befund[];
}) {
  const [open, setOpen] = useState(blocker.length > 0);
  const hasBlocker = blocker.length > 0;
  const hasWarnung = warnungen.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Blocker-Pill */}
        <span
          className="inline-flex items-center gap-2 min-h-[32px] px-3 text-[13px] font-sans"
          style={{
            borderRadius: 2,
            background: hasBlocker
              ? "color-mix(in oklab, var(--color-danger) 6%, var(--color-paper))"
              : "transparent",
            border: `1px solid ${hasBlocker ? "var(--color-danger)" : "var(--color-hairline)"}`,
            color: hasBlocker ? "var(--color-danger)" : "var(--color-stone-muted)",
          }}
        >
          {hasBlocker ? (
            <AlertOctagon className="size-4" strokeWidth={1.75} />
          ) : (
            <Check className="size-4" strokeWidth={1.75} />
          )}
          <span className="num-serif">{blocker.length}</span>{" "}
          {blocker.length === 1 ? "Blocker" : "Blocker"}
        </span>

        {/* Warnungen-Pill */}
        <span
          className="inline-flex items-center gap-2 min-h-[32px] px-3 text-[13px] font-sans"
          style={{
            borderRadius: 2,
            background: "transparent",
            border: `1px solid var(--color-hairline)`,
            color: hasWarnung ? "var(--color-ink)" : "var(--color-stone-muted)",
          }}
        >
          {hasWarnung ? null : <Check className="size-4" strokeWidth={1.75} />}
          <span className="num-serif">{warnungen.length}</span>{" "}
          {warnungen.length === 1 ? "Warnung" : "Warnungen"}
        </span>

        {(hasBlocker || hasWarnung) && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="link-quiet text-[13px] ml-auto"
          >
            {open ? "Liste ausblenden" : "Liste anzeigen"}
          </button>
        )}
      </div>

      {open && (hasBlocker || hasWarnung) && (
        <ul className="myr-card divide-y divide-[var(--color-hairline)]">
          {blocker.map((b, i) => (
            <BefundZeile key={`b-${i}`} b={b} ton="danger" />
          ))}
          {warnungen.map((b, i) => (
            <BefundZeile key={`w-${i}`} b={b} ton="muted" />
          ))}
        </ul>
      )}
    </div>
  );
}

function BefundZeile({ b, ton }: { b: Befund; ton: "danger" | "muted" }) {
  const color = ton === "danger" ? "var(--color-danger)" : "var(--color-stone-muted)";
  return (
    <li className="flex gap-3 px-4 py-3">
      <AlertOctagon className="size-4 shrink-0 mt-0.5" style={{ color }} strokeWidth={1.75} />
      <div className="min-w-0 text-[14px]">
        {b.raum && (
          <span className="font-medium text-[var(--color-ink)]">{b.raum}: </span>
        )}
        <span className="text-[var(--color-stone-muted)]">{b.message}</span>
      </div>
    </li>
  );
}

function PositionenListe({ positionen }: { positionen: Position[] }) {
  if (positionen.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--color-stone-muted)]">
        Noch keine Leistungspositionen erfasst.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {positionen.map((p) => (
        <PositionsKarte key={p.leistungs_code} p={p} />
      ))}
    </div>
  );
}

function PositionsKarte({ p }: { p: Position }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="myr-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 md:px-5 py-4 text-left hover:bg-[var(--color-sand-deep)] transition-colors duration-300"
        style={{ transitionTimingFunction: ease }}
      >
        {open ? (
          <ChevronDown className="size-5 shrink-0 text-[var(--color-stone-muted)]" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="size-5 shrink-0 text-[var(--color-stone-muted)]" strokeWidth={1.5} />
        )}
        <h3 className="font-serif text-[18px] md:text-[20px] leading-tight flex-1 min-w-0 truncate text-[var(--color-ink)]">
          {p.name}
        </h3>
        <span
          className="inline-flex items-center min-h-[26px] px-2.5 text-[12px] tracking-[0.08em] text-[var(--color-stone-muted)]"
          style={{
            borderRadius: 2,
            background: "var(--color-sand-deep)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          {p.einheit}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--color-hairline)]">
          {/* Header-Zeile auf md+ */}
          <div className="hidden md:grid grid-cols-[1fr_2fr_auto] gap-4 px-5 py-2 text-[11px] tracking-[0.12em] uppercase text-[var(--color-stone-muted)] border-b border-[var(--color-hairline)]">
            <span>Raum</span>
            <span>Formel</span>
            <span className="text-right">Ergebnis</span>
          </div>

          <ul className="divide-y divide-[var(--color-hairline)]">
            {p.zeilen.map((z, i) => (
              <li
                key={i}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_2fr_auto] gap-x-4 gap-y-1 px-4 md:px-5 py-3 min-h-[48px] items-baseline"
              >
                <span className="font-sans text-[14px] text-[var(--color-ink)] truncate">
                  {z.raum}
                </span>
                <span className="col-span-2 md:col-span-1 md:order-none order-3 text-[13px] text-[var(--color-stone-muted)] break-words md:truncate">
                  {z.formel}
                </span>
                <span className="num-serif text-[16px] text-[var(--color-ink)] text-right whitespace-nowrap">
                  = {de(z.ergebnis)}
                </span>
              </li>
            ))}
          </ul>

          <div
            className="border-t border-[var(--color-hairline)] flex items-baseline gap-3 px-4 md:px-5 py-4"
            style={{ background: "var(--color-sand-deep)" }}
          >
            <span className="font-sans text-[12px] uppercase tracking-[0.14em] text-[var(--color-stone-muted)] flex-1">
              Endsumme
            </span>
            <span className="num-serif text-[26px] md:text-[28px] leading-none text-[var(--color-ink)]">
              {de(p.endsumme)}
            </span>
            <span className="text-[12px] text-[var(--color-stone-muted)] tracking-[0.08em]">
              {p.einheit}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function FooterActions({
  projektId,
  antwort,
  projekt,
  hasBlocker,
}: {
  projektId: string;
  antwort: Antwort;
  projekt: ProjektMeta;
  hasBlocker: boolean;
}) {
  const brandingRows = () => {
    const heute = new Date().toLocaleDateString("de-DE");
    return [
      ["MYR – Deco & More"],
      ["Aufmaßprotokoll"],
      [`Projekt: ${projekt.objekt_bezeichnung ?? ""}`],
      [`Kunde: ${projekt.kunde ?? ""}`],
      ...(projekt.adresse ? [[`Adresse: ${projekt.adresse}`]] : []),
      ...(projekt.auftrag_nr ? [[`Auftrag: ${projekt.auftrag_nr}`]] : []),
      [`Erstellt: ${heute}`],
      [""],
    ];
  };

  const exportCsv = () => {
    const rows: string[][] = [
      ...brandingRows(),
      ["Position", "Einheit", "Raum", "Formel", "Ergebnis"],
    ];
    for (const p of antwort.uebergabe.positionen) {
      for (const z of p.zeilen) {
        rows.push([p.name, p.einheit, z.raum, z.formel, de(z.ergebnis)]);
      }
      rows.push([p.name, p.einheit, "Endsumme", "", de(p.endsumme)]);
    }
    const csvText = rows.map((r) => r.map(csv).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aufmass-${projekt.auftrag_nr ?? projektId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [xlsxBusy, setXlsxBusy] = useState(false);
  const exportRaumlevelXlsx = async () => {
    try {
      setXlsxBusy(true);
      const geo = await buildGeoProjekt(projektId);
      const zeilen = generateAufmassZeilen(geo);
      if (zeilen.length === 0) {
        toast.error("Keine Räume mit vollständigen Maßen erfasst.");
        return;
      }
      const bytes = zeilenToXlsx(zeilen);
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `raumlevel-${projekt.auftrag_nr ?? projektId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Raumlevel-Export erstellt (${zeilen.length} Zeilen).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Raumlevel-Export fehlgeschlagen");
    } finally {
      setXlsxBusy(false);
    }
  };

  const uebergeben = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("uebergabe").insert({
        projekt_id: projektId,
        daten: antwort.uebergabe as any,
      });
      if (error) throw error;
      await supabase
        .from("projekt")
        .update({ status: "uebergeben", uebergeben_at: new Date().toISOString() })
        .eq("id", projektId);
    },
    onSuccess: () => toast.success("Übergabe gespeichert (Schnittstelle folgt)."),
    onError: (e: any) => toast.error(e?.message ?? "Fehler bei der Übergabe"),
  });

  return (
    <div
      className="fixed left-0 right-0 bottom-16 md:bottom-0 md:left-[220px] z-20 border-t border-[var(--color-hairline)] bg-[var(--color-paper)]"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div className="mx-auto max-w-[720px] px-4 md:px-6 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="min-h-[48px] rounded-none border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] uppercase tracking-[0.14em] text-[12px] font-medium"
            onClick={exportCsv}
          >
            <FileDown className="size-4 mr-2" strokeWidth={1.75} /> CSV
          </Button>
          <Button
            variant="outline"
            className="min-h-[48px] rounded-none border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] uppercase tracking-[0.14em] text-[12px] font-medium"
            onClick={exportRaumlevelXlsx}
            disabled={xlsxBusy}
          >
            <FileSpreadsheet className="size-4 mr-2" strokeWidth={1.75} />
            {xlsxBusy ? "…" : "Excel"}
          </Button>
        </div>

        <Button
          className="w-full min-h-[52px] rounded-none bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={hasBlocker || uebergeben.isPending}
          onClick={() => uebergeben.mutate()}
        >
          {uebergeben.isPending ? "…" : "An Raumlevel übergeben →"}
        </Button>

        {hasBlocker && (
          <p className="text-[12px] text-center text-[var(--color-stone-muted)]">
            Bitte zuerst alle Blocker beheben
          </p>
        )}
      </div>
    </div>
  );
}

function csv(s: string) {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
