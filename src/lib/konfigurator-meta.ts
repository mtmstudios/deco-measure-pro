/**
 * Konfigurator-Metadaten: alles, was die Oberfläche braucht, aber nicht in den
 * generierten Preisdaten steht — Optionsgruppen (Einfach-/Mehrfachwahl), Klartext-
 * Modellnamen, Maximalmaße, breitenabhängige Verfügbarkeit, Pflichtwahl-Prüfung.
 *
 * Bewusst regelbasiert über die Zuschlag-Codes/-Namen, damit neue Modelle aus
 * tools/mhz-extract ohne Nacharbeit korrekt gruppiert werden.
 * → Getestete Referenz: aufmass-engine/src/konfigurator-meta.ts (identisch bis auf Import).
 */
import type { AnyProdukt, Produkt, Zuschlag } from "./preis-engine";

export type OptionsGruppeCode = "form" | "antrieb" | "kette" | "befestigung" | "klebeset" | "extras";

export interface OptionsGruppe {
  code: OptionsGruppeCode;
  label: string;
  /** true = höchstens eine Option wählbar (Radio), false = beliebig viele. */
  exklusiv: boolean;
}

/** Reihenfolge = Anzeige-Reihenfolge im Konfigurator. */
export const OPTIONS_GRUPPEN: OptionsGruppe[] = [
  { code: "form", label: "Anlagenform", exklusiv: true },
  { code: "antrieb", label: "Bedienung & Antrieb", exklusiv: true },
  { code: "kette", label: "Kette", exklusiv: true },
  { code: "befestigung", label: "Befestigung", exklusiv: true },
  { code: "klebeset", label: "Klebe-Set", exklusiv: true },
  { code: "extras", label: "Extras", exklusiv: false },
];

const GRUPPEN_REGELN: [RegExp, OptionsGruppeCode][] = [
  [/^(BIEGUNG|GESPANNT|SLOPE)$/, "form"],
  [/^(SOFT|KURBEL)$|^(SONESSE|SOMFY_|POWERVIEW_|SUNEA|MAESTRIA|ELEKTRO_|RTS_230)/, "antrieb"],
  [/^(METALLKETTE|KETTE_ANTIBAKT|BEDIENKETTE_METALL)/, "kette"],
  [/^KLEBESET_/, "klebeset"],
  [/^(KLEMM|WINKEL|GLASLEISTE|KLEBETRAEGER|FENSTERCLIP|SPANNHEBEL_|BEFESTIGUNGSSCHIENE)/, "befestigung"],
];

export function gruppeVon(code: string): OptionsGruppeCode {
  for (const [re, g] of GRUPPEN_REGELN) if (re.test(code)) return g;
  return "extras";
}

const zahl = (s: string) => Number(s.replace(",", "."));

/**
 * Breitenbereich aus dem Zuschlagsnamen, z. B. "Klemmträger 2 St. (bis 149,9 cm)" oder
 * "Elektro 230 V ab 400,1 cm: …". Höhenangaben ("bis 260 cm Höhe") zählen nicht.
 */
export function breitenBereich(z: Zuschlag): { min?: number; max?: number } {
  const r: { min?: number; max?: number } = {};
  for (const m of z.name.matchAll(/\b(bis|ab) (\d+(?:,\d+)?) cm(?! Höhe)/g)) {
    if (m[1] === "bis") r.max = zahl(m[2]);
    else r.min = zahl(m[2]);
  }
  return r;
}

/** Rasterindex wie in der Engine (nächster Wert ≥ Maß). -1 = über Raster. */
function rasterIdx(raster: number[], mass: number): number {
  return raster.findIndex((v) => mass <= v);
}

/**
 * Ist die Option bei dieser Breite wählbar? Berücksichtigt Namensbereiche und
 * breite_tabelle-Lücken (null = Ausführung ab dieser Breite nicht lieferbar).
 */
export function optionVerfuegbar(produkt: Produkt, z: Zuschlag, breite_cm?: number): boolean {
  if (!breite_cm || breite_cm <= 0) return true;
  const { min, max } = breitenBereich(z);
  if (min != null && breite_cm < min) return false;
  if (max != null && breite_cm > max) return false;
  if (z.typ === "breite_tabelle") {
    const idx = rasterIdx(produkt.preisgruppen[0].raster.breiten_cm, breite_cm);
    if (idx < 0 || z.breiten_werte?.[idx] == null) return false;
  }
  return true;
}

export interface GruppierteOptionen {
  gruppe: OptionsGruppe;
  optionen: Zuschlag[];
}

export function gruppiereOptionen(produkt: AnyProdukt): GruppierteOptionen[] {
  const alle = produkt.zuschlaege ?? [];
  return OPTIONS_GRUPPEN.map((gruppe) => ({
    gruppe,
    optionen: alle.filter((z) => gruppeVon(z.code) === gruppe.code),
  })).filter((g) => g.optionen.length > 0);
}

/**
 * Auswahl umschalten unter Beachtung der Gruppenregel: in exklusiven Gruppen ersetzt
 * eine neue Wahl die bisherige; erneutes Antippen hebt sie auf.
 */
export function toggleOption(gewaehlt: string[], code: string): string[] {
  if (gewaehlt.includes(code)) return gewaehlt.filter((c) => c !== code);
  const g = gruppeVon(code);
  const exklusiv = OPTIONS_GRUPPEN.find((x) => x.code === g)?.exklusiv;
  const rest = exklusiv ? gewaehlt.filter((c) => gruppeVon(c) !== g) : gewaehlt;
  return [...rest, code];
}

export interface ModellInfo {
  /** Kurzer Klartext, z. B. "Gespannt · frei verschiebbar". */
  titel: string;
  /** Optionaler Zusatz (Bedienvarianten, Besonderheiten). */
  hinweis?: string;
  /** Gruppen, in denen eine Wahl Pflicht ist (sonst Preis unvollständig). */
  pflicht?: OptionsGruppeCode[];
}

const MODELL_INFO: Record<string, ModellInfo> = {
  "Plissee|11-8120": { titel: "Gespannt · Behang oben fest" },
  "Plissee|11-8220": { titel: "Gespannt · frei verschiebbar" },
  "Plissee|11-8222": { titel: "Gespannt · frei verschiebbar, mit Griff" },
  "Plissee|11-8130": { titel: "Freihängend · Kettenzug", hinweis: "Auch als 11-8140 Elektro" },
  "Duette Wabenplissee|11-8120": { titel: "Gespannt · Behang oben fest" },
  "Duette Wabenplissee|11-8220": { titel: "Gespannt · frei verschiebbar" },
  "Duette Wabenplissee|11-8222": { titel: "Gespannt · frei verschiebbar, mit Griff" },
  "Duette Wabenplissee|11-8110": { titel: "Freihängend · Schnurzug" },
  "Duette Wabenplissee|11-8130": {
    titel: "Freihängend · Kettenzug",
    hinweis: "Elektro 24 V (= 11-8140) als Antrieb wählbar",
  },
  "Duette Wabenplissee|11-8145": { titel: "Freihängend · Akku-Motor 12 V", hinweis: "Motor-Set wählen" },
  "Duette Wabenplissee|11-8148": {
    titel: "Freihängend · Funk-Motor 18 V",
    hinweis: "Preis ohne Motor — Antrieb wählen",
    pflicht: ["antrieb"],
  },
  "Dachfenster-Plissee|11-7225": { titel: "Dachfenster · VELUX" },
  "Rollo|04-3300": { titel: "Basic · Träger mit Kette" },
  "Rollo|04-3302": { titel: "Träger · Kette", hinweis: "Soft, Elektro und Akku als Antrieb wählbar" },
  "Rollo|04-3342": { titel: "Kassette", hinweis: "Soft, Kurbel, Elektro und Akku wählbar" },
  "Rollo|04-3352": { titel: "Kassette mit Seitenführung", hinweis: "Kurbel, Elektro und Akku wählbar" },
  "Rollo|04-3402": { titel: "Groß · Träger", hinweis: "Elektro wählbar" },
  "Rollo|04-3442": { titel: "Groß · Kassette", hinweis: "Kurbel und Elektro wählbar" },
  "Rollo|04-3464": { titel: "ZIP-Kassette · Elektro" },
  "Rollo|04-3504": { titel: "Extra groß · Elektro" },
  "Lamellenvorhang|05-7227": { titel: "127 mm Lamelle", hinweis: "Classic, Standard, Slope, gebogen, gespannt" },
  "Lamellenvorhang|05-7289": { titel: "89 mm Lamelle", hinweis: "Classic, Standard, Slope, gebogen, gespannt" },
  "Lamellenvorhang|05-7025": { titel: "250 mm Lamelle", hinweis: "Classic, gebogen, gespannt" },
};

export function modellInfo(p: AnyProdukt): ModellInfo {
  return MODELL_INFO[`${p.produkt}|${p.modell ?? ""}`] ?? { titel: p.modell ?? p.produkt };
}

/** Größtes Rastermaß über alle Preisgruppen (= maximal lieferbar laut Liste). */
export function maxMasse(p: Produkt): { breite_cm: number; hoehe_cm: number } {
  let breite_cm = 0;
  let hoehe_cm = 0;
  for (const g of p.preisgruppen) {
    breite_cm = Math.max(breite_cm, g.raster.breiten_cm[g.raster.breiten_cm.length - 1] ?? 0);
    hoehe_cm = Math.max(hoehe_cm, g.raster.hoehen_cm[g.raster.hoehen_cm.length - 1] ?? 0);
  }
  return { breite_cm, hoehe_cm };
}

/** Kurzlabel einer Preisgruppe: "Wabengruppe W3" → "W3", "Preisgruppe A" → "A". */
export function kurzGruppe(name: string): string {
  const teile = name.trim().split(/\s+/);
  return teile[teile.length - 1] ?? name;
}

/** Fehlende Pflichtwahlen (Gruppen-Labels) für die aktuelle Auswahl. */
export function fehlendePflicht(p: AnyProdukt, gewaehlt: string[]): string[] {
  const info = modellInfo(p);
  return (info.pflicht ?? [])
    .filter((g) => !gewaehlt.some((c) => gruppeVon(c) === g))
    .map((g) => OPTIONS_GRUPPEN.find((x) => x.code === g)?.label ?? g);
}
