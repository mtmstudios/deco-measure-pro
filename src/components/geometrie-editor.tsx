import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Optionale Maßketten-/Polygon-Eingabe pro Raum für den Raumlevel-Export.
 * - "rechteck": nutzt die Länge/Breite aus den Raumdaten (Standard).
 * - "masskette": Wandabschnitte (cm) + Boden-Terme (Rechtecke/Dreiecke) für
 *   nicht-rechteckige Räume — entspricht der Raumlevel-Logik.
 * Persistiert in raum.geometrie (jsonb).
 */

export type BodenTerm = { laenge_cm: number; breite_cm: number; dreieck?: boolean };
export type RaumGeometrie = {
  modus?: "rechteck" | "masskette";
  wand_abschnitte_cm?: number[];
  boden_terme?: BodenTerm[];
};

type Modus = "rechteck" | "masskette";
type BodenRow = { laenge: string; breite: string; dreieck: boolean };

const fmtM = (cm: number) => (cm / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM2 = (m2: number) => m2.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GeometrieEditor({ raumId, initial }: { raumId: string; initial: RaumGeometrie | null }) {
  const [modus, setModus] = useState<Modus>(initial?.modus ?? "rechteck");
  const [wand, setWand] = useState<string[]>((initial?.wand_abschnitte_cm ?? []).map((n) => String(n)));
  const [boden, setBoden] = useState<BodenRow[]>(
    (initial?.boden_terme ?? []).map((t) => ({ laenge: String(t.laenge_cm), breite: String(t.breite_cm), dreieck: !!t.dreieck })),
  );

  const toGeo = (o: { modus?: Modus; wand?: string[]; boden?: BodenRow[] }): RaumGeometrie => ({
    modus: o.modus ?? modus,
    wand_abschnitte_cm: (o.wand ?? wand).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0),
    boden_terme: (o.boden ?? boden)
      .map((r) => ({ laenge_cm: Number(r.laenge) || 0, breite_cm: Number(r.breite) || 0, dreieck: r.dreieck }))
      .filter((t) => t.laenge_cm > 0 && t.breite_cm > 0),
  });

  async function persist(g: RaumGeometrie) {
    const { error } = await supabase.from("raum").update({ geometrie: g } as never).eq("id", raumId);
    if (error) {
      toast.error(
        /geometrie/i.test(error.message)
          ? "DB-Spalte 'geometrie' fehlt – bitte Migration anwenden (siehe Hinweis)."
          : error.message,
      );
    }
  }

  const wandSummeCm = wand.map((s) => Number(s)).filter((n) => n > 0).reduce((a, b) => a + b, 0);
  const bodenSummeM2 = boden.reduce((a, r) => {
    const l = Number(r.laenge) || 0;
    const b = Number(r.breite) || 0;
    return a + (l * b) / 10000 / (r.dreieck ? 2 : 1);
  }, 0);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight">Geometrie für Raumlevel (optional)</h2>
      <p className="text-sm text-muted-foreground">
        Rechteckige Räume nutzen automatisch Länge × Breite. Für verwinkelte Räume hier die einzelnen
        Wandabschnitte und Bodenflächen erfassen.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {(["rechteck", "masskette"] as const).map((mo) => (
          <button
            key={mo}
            onClick={() => {
              setModus(mo);
              persist(toGeo({ modus: mo }));
            }}
            className={cn(
              "h-12 rounded-lg border-2 font-semibold text-sm",
              modus === mo ? "border-primary bg-primary/10 text-primary" : "border-input bg-background",
            )}
          >
            {mo === "rechteck" ? "Rechteck (L×B)" : "Maßkette"}
          </button>
        ))}
      </div>

      {modus === "masskette" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Wandabschnitte</span>
              <span className="text-sm text-muted-foreground">Umfang: {fmtM(wandSummeCm)} m</span>
            </div>
            {wand.map((v, i) => (
              <div key={i} className="flex gap-2">
                <NumberInput
                  suffix="cm"
                  value={v}
                  onChange={(e) => {
                    const nw = [...wand];
                    nw[i] = e.target.value;
                    setWand(nw);
                  }}
                  onBlur={() => persist(toGeo({}))}
                  className="flex-1"
                />
                <button
                  onClick={() => {
                    const nw = wand.filter((_, j) => j !== i);
                    setWand(nw);
                    persist(toGeo({ wand: nw }));
                  }}
                  aria-label="Abschnitt löschen"
                  className="size-14 rounded-lg border-2 border-input text-destructive flex items-center justify-center"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            ))}
            <Button variant="outline" className="h-12 w-full" onClick={() => setWand([...wand, ""])}>
              <Plus className="size-4 mr-1" /> Wandabschnitt hinzufügen
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Bodenfläche (Teilflächen)</span>
              <span className="text-sm text-muted-foreground">Σ {fmtM2(bodenSummeM2)} m²</span>
            </div>
            {boden.map((r, i) => (
              <div key={i} className="rounded-lg border-2 border-input p-2 space-y-2 bg-background">
                <div className="flex gap-2">
                  <NumberInput
                    label="Länge"
                    suffix="cm"
                    value={r.laenge}
                    onChange={(e) => {
                      const nb = [...boden];
                      nb[i] = { ...r, laenge: e.target.value };
                      setBoden(nb);
                    }}
                    onBlur={() => persist(toGeo({}))}
                    className="flex-1"
                  />
                  <NumberInput
                    label="Breite"
                    suffix="cm"
                    value={r.breite}
                    onChange={(e) => {
                      const nb = [...boden];
                      nb[i] = { ...r, breite: e.target.value };
                      setBoden(nb);
                    }}
                    onBlur={() => persist(toGeo({}))}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const nb = [...boden];
                      nb[i] = { ...r, dreieck: !r.dreieck };
                      setBoden(nb);
                      persist(toGeo({ boden: nb }));
                    }}
                    className={cn(
                      "flex-1 h-11 rounded-md border-2 text-sm font-semibold",
                      r.dreieck ? "border-primary bg-primary/10 text-primary" : "border-input",
                    )}
                  >
                    {r.dreieck ? "Dreieck (÷2)" : "Rechteck"}
                  </button>
                  <button
                    onClick={() => {
                      const nb = boden.filter((_, j) => j !== i);
                      setBoden(nb);
                      persist(toGeo({ boden: nb }));
                    }}
                    aria-label="Teilfläche löschen"
                    className="size-11 rounded-md border-2 border-input text-destructive flex items-center justify-center"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => setBoden([...boden, { laenge: "", breite: "", dreieck: false }])}
            >
              <Plus className="size-4 mr-1" /> Teilfläche hinzufügen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
