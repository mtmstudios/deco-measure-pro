/**
 * Montage- & Fahrtkosten von Deco & More (eigene Dienstleistungssätze, nicht MHZ).
 * Alle Beträge BRUTTO (inkl. 19 % MwSt.), konsistent zu den Produktpreisen (UVP inkl. MwSt.).
 * Netto-Basis laut Nicole (12.09.2026): Montage 29,90 / 39,00 / 60,00; Fahrt 49,00 / 59,00 / 79,00.
 *
 * Montage ist typabhängig → pro Position wählbar. Fahrt ist eine Staffel je Auftrag (projektweit).
 * Änderungssichere Stelle: hier zentral. (Später ggf. in Einstellungen editierbar.)
 */

export type KostenOption = {
  code: string;
  label: string;
  /** Betrag pro Einheit, brutto (EUR). */
  brutto: number;
};

/** Montage je Position — Satz hängt vom Befestigungs-/Produkttyp ab. */
export const MONTAGE_OPTIONEN: KostenOption[] = [
  { code: "verspannt", label: "Verspannt", brutto: 35.58 }, // 29,90 netto
  { code: "klemm_klebe", label: "Klemmträger + Klebeleiste", brutto: 46.41 }, // 39,00 netto
  { code: "dachfenster", label: "Dachfenster / Sonderfenster", brutto: 71.4 }, // 60,00 netto
  { code: "keine", label: "Keine Montage", brutto: 0 },
];

/** Fahrt/Anfahrt je Auftrag — gestaffelt nach Entfernung. */
export const FAHRT_OPTIONEN: KostenOption[] = [
  { code: "innerorts", label: "Innerorts", brutto: 58.31 }, // 49,00 netto
  { code: "zone1", label: "Zone 1", brutto: 70.21 }, // 59,00 netto
  { code: "zone2", label: "Zone 2", brutto: 94.01 }, // 79,00 netto
  { code: "keine", label: "Keine Fahrt", brutto: 0 },
];

export const montageByCode = (code: string | null | undefined) =>
  MONTAGE_OPTIONEN.find((o) => o.code === code);
export const fahrtByCode = (code: string | null | undefined) =>
  FAHRT_OPTIONEN.find((o) => o.code === code);

/** Sinnvoller Montage-Standard je Produkt. */
export const defaultMontageCode = (istDachfenster: boolean): string =>
  istDachfenster ? "dachfenster" : "verspannt";
