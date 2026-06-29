import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildEngineProjekt } from "@/lib/build-engine-projekt";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronRight,
  FileDown,
  Send,
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
type Befund = { schwere: "block" | "warnung"; code: string; raum?: string; message: string };
type Antwort = {
  uebergabe: {
    schema_version: string;
    projekt: { kunde: string | null; objekt_bezeichnung: string | null; auftrag_nr: string | null; gewerk: string | null };
    positionen: Position[];
    kennzahlen?: any[];
  };
  befunde: Befund[];
  blocker: boolean;
};

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

  const befunde = data?.befunde ?? [];
  const blocker = befunde.filter((b) => b.schwere === "block");
  const warnungen = befunde.filter((b) => b.schwere === "warnung");

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-3 py-3 flex items-center gap-2">
          <Link
            to="/projekt/$id"
            params={{ id }}
            aria-label="Zurück"
            className="size-12 rounded-lg flex items-center justify-center active:bg-accent"
          >
            <ArrowLeft className="size-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Vorschau</h1>
          {isFetching && <Loader2 className="size-5 animate-spin text-muted-foreground ml-auto" />}
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Berechne Positionen…</div>
        ) : error ? (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4">
            <p className="font-semibold text-destructive">Fehler bei der Berechnung</p>
            <p className="text-sm mt-1">{(error as Error).message}</p>
            <Button className="mt-3 h-12" onClick={() => refetch()}>
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

      {data && (
        <FooterActions projektId={id} antwort={data} hasBlocker={data.blocker} />
      )}
    </div>
  );
}

function BefundLeiste({ blocker, warnungen }: { blocker: Befund[]; warnungen: Befund[] }) {
  const [open, setOpen] = useState(blocker.length > 0);
  const total = blocker.length + warnungen.length;
  if (total === 0) {
    return (
      <div className="rounded-xl border-2 border-success bg-success/10 px-4 py-3 text-success-foreground/90 font-semibold">
        Keine Befunde – alles plausibel.
      </div>
    );
  }
  return (
    <div className="rounded-xl border-2 border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 active:bg-accent"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-sm font-bold">
            <AlertOctagon className="size-4" /> {blocker.length} Blocker
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning text-warning-foreground text-sm font-bold">
            <AlertTriangle className="size-4" /> {warnungen.length} Warnung
            {warnungen.length === 1 ? "" : "en"}
          </span>
        </div>
        <span className="ml-auto">
          {open ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
        </span>
      </button>
      {open && (
        <ul className="divide-y border-t">
          {blocker.map((b, i) => (
            <li key={`b-${i}`} className="px-4 py-2 flex gap-2 bg-destructive/5">
              <AlertOctagon className="size-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                {b.raum && <span className="font-semibold">{b.raum}: </span>}
                {b.message}
              </div>
            </li>
          ))}
          {warnungen.map((b, i) => (
            <li key={`w-${i}`} className="px-4 py-2 flex gap-2 bg-warning/5">
              <AlertTriangle className="size-4 text-warning-foreground shrink-0 mt-0.5" />
              <div className="text-sm">
                {b.raum && <span className="font-semibold">{b.raum}: </span>}
                {b.message}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PositionenListe({ positionen }: { positionen: Position[] }) {
  if (positionen.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
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
    <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 active:bg-accent"
      >
        {open ? (
          <ChevronDown className="size-5 shrink-0" />
        ) : (
          <ChevronRight className="size-5 shrink-0" />
        )}
        <h3 className="text-base font-bold flex-1 text-left">{p.name}</h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md border-2 border-border text-sm font-bold">
          {p.einheit}
        </span>
      </button>
      {open && (
        <div className="border-t divide-y">
          {p.zeilen.map((z, i) => (
            <div key={i} className="px-4 py-2 flex items-baseline gap-3">
              <span className="font-semibold w-24 shrink-0 truncate">{z.raum}</span>
              <span className="text-sm text-muted-foreground flex-1 break-words">{z.formel}</span>
              <span className="font-bold tabular-nums whitespace-nowrap">= {de(z.ergebnis)}</span>
            </div>
          ))}
          <div className="px-4 py-3 flex items-baseline gap-3 bg-accent/40">
            <span className="font-bold flex-1">Endsumme</span>
            <span className="text-lg font-extrabold tabular-nums">{de(p.endsumme)}</span>
            <span className="text-sm font-semibold text-muted-foreground">{p.einheit}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FooterActions({
  projektId,
  antwort,
  hasBlocker,
}: {
  projektId: string;
  antwort: Antwort;
  hasBlocker: boolean;
}) {
  const exportCsv = () => {
    const rows: string[] = [];
    rows.push(["Position", "Einheit", "Raum", "Formel", "Ergebnis"].join(";"));
    for (const p of antwort.uebergabe.positionen) {
      for (const z of p.zeilen) {
        rows.push([p.name, p.einheit, z.raum, z.formel, de(z.ergebnis)].map(csv).join(";"));
      }
      rows.push([p.name, p.einheit, "Endsumme", "", de(p.endsumme)].map(csv).join(";"));
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aufmass-${antwort.uebergabe.projekt.auftrag_nr ?? projektId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uebergeben = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("uebergabe").insert({
        projekt_id: projektId,
        daten: antwort.uebergabe as any,
      });
      if (error) throw error;
      await supabase.from("projekt").update({ status: "uebergeben" }).eq("id", projektId);
    },
    onSuccess: () => toast.success("Übergabe gespeichert (Schnittstelle folgt)."),
    onError: (e: any) => toast.error(e?.message ?? "Fehler bei der Übergabe"),
  });

  return (
    <div className="fixed bottom-16 left-0 right-0 z-10 border-t bg-background px-3 py-3 flex gap-2 safe-area-inset-bottom">
      <Button variant="outline" className="h-14 flex-1 text-base font-bold" onClick={exportCsv}>
        <FileDown className="size-5 mr-1" /> Export
      </Button>
      <Button
        className="h-14 flex-1 text-base font-bold"
        disabled={hasBlocker || uebergeben.isPending}
        onClick={() => uebergeben.mutate()}
        title={hasBlocker ? "Blocker müssen behoben werden" : undefined}
      >
        <Send className="size-5 mr-1" />
        {uebergeben.isPending ? "…" : "An Raumlevel übergeben"}
      </Button>
    </div>
  );
}

function csv(s: string) {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
