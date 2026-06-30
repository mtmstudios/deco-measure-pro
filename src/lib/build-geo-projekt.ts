import { supabase } from "@/integrations/supabase/client";
import type { FlaechenTerm, GeoOeffnung, GeoProjekt, GeoRaum, Massketten } from "./raumlevel-export";
import type { RaumGeometrie } from "@/components/geometrie-editor";

/**
 * Baut aus den DB-Zeilen das GeoProjekt für den Raumlevel-XLSX-Export.
 * - Geometrie-Modus "masskette" (raum.geometrie) → Wandabschnitte + Boden-Terme.
 * - sonst Rechteck (Länge × Breite) aus den Raumdaten.
 * Acrylfuge/Leibung werden aus den Öffnungen abgeleitet (Raumlevel-Konvention).
 */
export async function buildGeoProjekt(projektId: string): Promise<GeoProjekt> {
  const { data: projekt } = await supabase.from("projekt").select("*").eq("id", projektId).single();

  const { data: raeume } = await supabase
    .from("raum")
    .select("*")
    .eq("projekt_id", projektId)
    .order("reihenfolge", { ascending: true });

  const raumIds = (raeume ?? []).map((r: any) => r.id);

  let oeffnungen: any[] = [];
  if (raumIds.length) {
    const res = await supabase.from("oeffnung").select("*").in("raum_id", raumIds);
    oeffnungen = res.data ?? [];
  }

  const geoRaeume: GeoRaum[] = [];
  for (const r of (raeume ?? []) as any[]) {
    if (!r.raumhoehe_cm) continue; // ohne Raumhöhe kein Aufmaß

    const g = (r.geometrie ?? null) as RaumGeometrie | null;

    let wand: Massketten;
    let boden: FlaechenTerm[] | undefined;
    if (g?.modus === "masskette" && g.wand_abschnitte_cm && g.wand_abschnitte_cm.length > 0) {
      wand = { abschnitte_m: g.wand_abschnitte_cm.map((cm) => cm / 100) };
      boden =
        g.boden_terme && g.boden_terme.length > 0
          ? g.boden_terme.map((t) => ({ laenge_m: t.laenge_cm / 100, breite_m: t.breite_cm / 100, dreieck: t.dreieck }))
          : undefined;
    } else {
      if (!r.laenge_cm || !r.breite_cm) continue; // Rechteck-Modus braucht Länge × Breite
      wand = { rechteck: { laenge_m: r.laenge_cm / 100, breite_m: r.breite_cm / 100 } };
      boden = undefined; // wird aus dem Rechteck abgeleitet
    }

    const oe = oeffnungen.filter((o) => o.raum_id === r.id);
    const geoOeffnungen: GeoOeffnung[] = [];
    for (const o of oe) {
      const d = (o.daten ?? {}) as Record<string, unknown>;
      const anzahl = Number(d.anzahl) || 1;
      const art: "fenster" | "tuer" = o.typ === "tuer" || o.typ === "tuerelement" ? "tuer" : "fenster";
      const breite_m = (o.breite_cm ?? 0) / 100;
      const hoehe_m = (o.hoehe_cm ?? 0) / 100;
      const leibung_tiefe_m =
        d.leibung_vorhanden && d.leibung_tiefe_cm ? Number(d.leibung_tiefe_cm) / 100 : undefined;
      const abzug = d.von_wandflaeche_abziehen === false ? false : undefined;
      for (let i = 0; i < anzahl; i++) geoOeffnungen.push({ art, breite_m, hoehe_m, leibung_tiefe_m, abzug });
    }

    geoRaeume.push({
      geschoss: r.etage ?? "",
      raum: r.name,
      raumhoehe_m: r.raumhoehe_cm / 100,
      wand,
      boden,
      oeffnungen: geoOeffnungen,
    });
  }

  return {
    objekt: projekt?.objekt_bezeichnung ?? projekt?.kunde ?? "Objekt",
    raeume: geoRaeume,
  };
}
