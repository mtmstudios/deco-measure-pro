import { supabase } from "@/integrations/supabase/client";
import type { GeoOeffnung, GeoProjekt, GeoRaum } from "./raumlevel-export";

/**
 * Baut aus den DB-Zeilen das GeoProjekt für den Raumlevel-XLSX-Export.
 * Stand v1: rechteckige Räume (Länge × Breite). Wandabschnitts-/Polygon-Eingabe
 * für komplexe Räume folgt separat. Acrylfuge/Leibung werden aus den Öffnungen
 * abgeleitet (Raumlevel-Konvention), nicht aus acryl_position.
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
  for (const r of raeume ?? []) {
    if (!r.laenge_cm || !r.breite_cm || !r.raumhoehe_cm) continue; // ohne Maße kein Aufmaß

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
      // Default: Raumlevel-Größenregel (>2,5 m²). Nur explizites "nicht abziehen" überschreibt.
      const abzug = d.von_wandflaeche_abziehen === false ? false : undefined;
      for (let i = 0; i < anzahl; i++) geoOeffnungen.push({ art, breite_m, hoehe_m, leibung_tiefe_m, abzug });
    }

    geoRaeume.push({
      geschoss: r.etage ?? "",
      raum: r.name,
      raumhoehe_m: r.raumhoehe_cm / 100,
      wand: { rechteck: { laenge_m: r.laenge_cm / 100, breite_m: r.breite_cm / 100 } },
      oeffnungen: geoOeffnungen,
    });
  }

  return {
    objekt: projekt?.objekt_bezeichnung ?? projekt?.kunde ?? "Objekt",
    raeume: geoRaeume,
  };
}
