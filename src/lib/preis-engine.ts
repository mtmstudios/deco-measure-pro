/**
 * Preis-Engine (Sonnenschutz-Konfigurator).
 *
 * Aus einer Produkt-Konfiguration (Preisgruppe/Stoff, Breite, Höhe) wird der
 * Verkaufs-/Einkaufspreis ermittelt: Maß auf das nächste Raster AUFRUNDEN,
 * Grundpreis in der Preismatrix nachschlagen, Zuschläge addieren.
 *
 * Die Preis-Matrizen stammen aus den Hersteller-Preislisten (MHZ 2025, PDF).
 * Diese Datei ist herstellerneutral & self-contained (analog raumlevel-export.ts).
 * → Getestete Referenz: aufmass-engine/src/preis-engine.ts (npm test grün).
 *
 * ⚠️ Werte im Beispiel-Produkt unten sind PLATZHALTER. Die echten Matrizen
 *    werden aus Plissee_25.pdf / Duette_25.pdf … extrahiert und hier bzw. in
 *    Supabase (Tabellen produkt / preisgruppe / preis_raster / zuschlag) befüllt.
 */

/** Kaufmännische Rundung auf `decimals` Nachkommastellen. */
function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export interface PreisRaster {
  /** Raster-Obergrenzen Breite (cm), aufsteigend — Spalten der Matrix. */
  breiten_cm: number[];
  /** Raster-Obergrenzen Höhe (cm), aufsteigend — Zeilen der Matrix. */
  hoehen_cm: number[];
  /** matrix[hoeheIndex][breiteIndex] = Preis (EUR). null = nicht lieferbar. */
  matrix: (number | null)[][];
}

export interface Preisgruppe {
  code: string;
  name: string;
  raster: PreisRaster;
}

export type ZuschlagTyp = "fix" | "prozent" | "pro_m2";

export interface Zuschlag {
  code: string;
  name: string;
  typ: ZuschlagTyp;
  wert: number;
}

export interface Produkt {
  hersteller: string;
  produkt: string;
  modell?: string;
  /** z. B. "UVP inkl. MwSt." oder "EK netto" — nur Doku, keine Berechnung. */
  preisbasis?: string;
  preisgruppen: Preisgruppe[];
  zuschlaege?: Zuschlag[];
  mindest_breite_cm?: number;
  mindest_hoehe_cm?: number;
}

export interface Konfiguration {
  preisgruppe: string;
  breite_cm: number;
  hoehe_cm: number;
  /** aktivierte Zuschlag-Codes (z. B. Motor, Sonderfarbe). */
  zuschlaege?: string[];
}

export interface PreisErgebnis {
  /** false = diese Breiten-/Höhen-Kombination ist nicht im Preisraster. */
  lieferbar: boolean;
  grundpreis: number;
  zuschlaege: { name: string; betrag: number }[];
  gesamt: number;
  /** tatsächlich verwendetes (aufgerundetes) Raster. */
  raster: { breite_cm: number; hoehe_cm: number };
  hinweise: string[];
}

/** Nächster Rasterwert ≥ Maß; wenn keiner passt → letzter + Über-Flag. */
function rasterIndex(raster: number[], mass: number): { idx: number; ueber: boolean } {
  for (let i = 0; i < raster.length; i++) {
    if (mass <= raster[i]) return { idx: i, ueber: false };
  }
  return { idx: raster.length - 1, ueber: true };
}

export function berechnePreis(produkt: Produkt, konfig: Konfiguration): PreisErgebnis {
  const pg = produkt.preisgruppen.find((g) => g.code === konfig.preisgruppe);
  if (!pg) throw new Error(`Preisgruppe "${konfig.preisgruppe}" nicht gefunden`);

  const hinweise: string[] = [];
  let b = konfig.breite_cm;
  let h = konfig.hoehe_cm;

  if (produkt.mindest_breite_cm && b < produkt.mindest_breite_cm) {
    b = produkt.mindest_breite_cm;
    hinweise.push(`Breite auf Mindestmaß ${b} cm angehoben`);
  }
  if (produkt.mindest_hoehe_cm && h < produkt.mindest_hoehe_cm) {
    h = produkt.mindest_hoehe_cm;
    hinweise.push(`Höhe auf Mindestmaß ${h} cm angehoben`);
  }

  const bi = rasterIndex(pg.raster.breiten_cm, b);
  const hi = rasterIndex(pg.raster.hoehen_cm, h);
  if (bi.ueber || hi.ueber) hinweise.push("Maß über Preisraster — Preis manuell prüfen");

  const rasterB = pg.raster.breiten_cm[bi.idx];
  const rasterH = pg.raster.hoehen_cm[hi.idx];
  const grundpreis = pg.raster.matrix[hi.idx]?.[bi.idx];
  if (grundpreis == null) {
    return {
      lieferbar: false,
      grundpreis: 0,
      zuschlaege: [],
      gesamt: 0,
      raster: { breite_cm: rasterB, hoehe_cm: rasterH },
      hinweise: [
        ...hinweise,
        `Nicht lieferbar: Breite ${rasterB} cm × Höhe ${rasterH} cm ist im Preisraster nicht vorgesehen (max. Höhe für diese Breite beachten).`,
      ],
    };
  }

  const zuschlaege: { name: string; betrag: number }[] = [];
  for (const code of konfig.zuschlaege ?? []) {
    const z = (produkt.zuschlaege ?? []).find((x) => x.code === code);
    if (!z) continue;
    let betrag = 0;
    if (z.typ === "fix") betrag = z.wert;
    else if (z.typ === "prozent") betrag = (grundpreis * z.wert) / 100;
    else if (z.typ === "pro_m2") betrag = z.wert * ((rasterB * rasterH) / 10000);
    zuschlaege.push({ name: z.name, betrag: round(betrag) });
  }

  const gesamt = round(grundpreis + zuschlaege.reduce((a, z) => a + z.betrag, 0));
  return {
    lieferbar: true,
    grundpreis: round(grundpreis),
    zuschlaege,
    gesamt,
    raster: { breite_cm: rasterB, hoehe_cm: rasterH },
    hinweise,
  };
}

// Echte Produktdaten (MHZ Plissee 11-8120) liegen in ./preis-data.ts.
