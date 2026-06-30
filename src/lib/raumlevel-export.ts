/**
 * Raumlevel-Export: Geometrie-Generator + dependency-freier XLSX-Writer.
 * Erzeugt das exakte Raumlevel-Import-Format (Spalten:
 * Objekt | Geschoss | Raum | Element | Formel | Ergebnis | Einheit),
 * verifiziert gegen das Kaiser-Sample (Muster.XLS / Aufmass240145.pdf).
 *
 * Verifizierte Konventionen:
 *  - Wandfläche   = (Σ Wandabschnitte) · Raumhöhe   [brutto]
 *  - Öffnungsabzug = -(b·h)  als Minus-Zeile, NUR wenn Fläche > Schwelle (~2,5 m², VOB/DIN)
 *  - Leibung      = (b + 2·h) · Tiefe
 *  - Acrylfuge    = b + 2·h                          [m]
 *  - Fensterfläche = b · h
 *  - Fußleiste    = Σ Wandabschnitte                 [m]
 *  - Boden/Decke  = Σ Rechtecke (l·b) + Dreiecke (l·b/2)
 *  - Bodenfläche Türnische = b · Tiefe
 */

export type Einheit2 = "m²" | "m";

export interface AufmassZeile {
  objekt: string;
  geschoss: string;
  raum: string;
  element: string;
  formel: string;
  ergebnis: number;
  einheit: Einheit2;
}

export type Massketten =
  | { rechteck: { laenge_m: number; breite_m: number } }
  | { abschnitte_m: number[] };

export interface FlaechenTerm {
  laenge_m: number;
  breite_m: number;
  dreieck?: boolean;
}

export interface GeoOeffnung {
  art: "fenster" | "tuer";
  breite_m: number;
  hoehe_m: number;
  leibung_tiefe_m?: number;
  abzug?: boolean;
}

export interface GeoRaum {
  geschoss: string;
  raum: string;
  raumhoehe_m: number;
  wand: Massketten;
  boden?: FlaechenTerm[];
  decke_wie_boden?: boolean;
  oeffnungen?: GeoOeffnung[];
  tuernischen?: { breite_m: number; tiefe_m: number }[];
}

export interface GeoProjekt {
  objekt: string;
  raeume: GeoRaum[];
  abzug_schwelle_m2?: number;
}

const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;
const m2 = (v: number): string => v.toFixed(2).replace(".", ",");

export function generateRaumZeilen(objekt: string, raum: GeoRaum, schwelle = 2.5): AufmassZeile[] {
  const z: AufmassZeile[] = [];
  const push = (element: string, formel: string, wert: number, einheit: Einheit2) =>
    z.push({ objekt, geschoss: raum.geschoss, raum: raum.raum, element, formel, ergebnis: round2(wert), einheit });

  for (const o of raum.oeffnungen ?? []) {
    const flaeche = o.breite_m * o.hoehe_m;
    const istFenster = o.art === "fenster";
    const abzug = o.abzug ?? flaeche > schwelle;

    if (abzug) {
      push(
        istFenster ? "Wandfläche Fensterabzug" : "Wandfläche Durchgangsabzug",
        `-(${m2(o.breite_m)}*${m2(o.hoehe_m)})`,
        -flaeche,
        "m²",
      );
    }
    if (o.leibung_tiefe_m && o.leibung_tiefe_m > 0) {
      const lfm = o.breite_m + 2 * o.hoehe_m;
      push("Leibung", `(${m2(o.breite_m)}+2*${m2(o.hoehe_m)})*${m2(o.leibung_tiefe_m)}`, lfm * o.leibung_tiefe_m, "m²");
    }
    if (istFenster) {
      push("Fensterfläche", `${m2(o.breite_m)}*${m2(o.hoehe_m)}`, flaeche, "m²");
      push("Acrylfuge", `${m2(o.breite_m)}+2*${m2(o.hoehe_m)}`, o.breite_m + 2 * o.hoehe_m, "m");
    }
  }

  let base: string;
  let wandFormel: string;
  let fussFormel: string;
  let wandWert: number;
  let fussWert: number;
  if ("rechteck" in raum.wand) {
    const { laenge_m: l, breite_m: b } = raum.wand.rechteck;
    base = `2*(${m2(l)}+${m2(b)})`;
    fussFormel = base;
    fussWert = 2 * (l + b);
    wandFormel = `${base}*${m2(raum.raumhoehe_m)}`;
    wandWert = 2 * (l + b) * raum.raumhoehe_m;
  } else {
    const segs = raum.wand.abschnitte_m;
    const sumStr = segs.map(m2).join("+");
    const sum = segs.reduce((a, x) => a + x, 0);
    fussFormel = sumStr;
    fussWert = sum;
    wandFormel = `(${sumStr})*${m2(raum.raumhoehe_m)}`;
    wandWert = sum * raum.raumhoehe_m;
  }
  push("Wandfläche", wandFormel, wandWert, "m²");
  push("Fußleiste", fussFormel, fussWert, "m");

  for (const tn of raum.tuernischen ?? []) {
    push("Bodenfläche Türnische", `${m2(tn.breite_m)}*${m2(tn.tiefe_m)}`, tn.breite_m * tn.tiefe_m, "m²");
  }

  let bodenTerme = raum.boden;
  if (!bodenTerme && "rechteck" in raum.wand) {
    bodenTerme = [{ laenge_m: raum.wand.rechteck.laenge_m, breite_m: raum.wand.rechteck.breite_m }];
  }
  if (bodenTerme && bodenTerme.length > 0) {
    const formel = bodenTerme.map((t) => `${m2(t.laenge_m)}*${m2(t.breite_m)}${t.dreieck ? "/2" : ""}`).join("+");
    const wert = bodenTerme.reduce((a, t) => a + (t.laenge_m * t.breite_m) / (t.dreieck ? 2 : 1), 0);
    push("Bodenfläche", formel, wert, "m²");
    if (raum.decke_wie_boden !== false) push("Deckenfläche", formel, wert, "m²");
  }

  return z;
}

export function generateAufmassZeilen(projekt: GeoProjekt): AufmassZeile[] {
  const schwelle = projekt.abzug_schwelle_m2 ?? 2.5;
  const out: AufmassZeile[] = [];
  for (const raum of projekt.raeume) out.push(...generateRaumZeilen(projekt.objekt, raum, schwelle));
  return out;
}

/* ---------- XLSX-Writer (Store-ZIP + minimales OOXML, dependency-frei) ---------- */

const enc = new TextEncoder();

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function zipStore(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    locals.push(local, e.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length + size;
  }

  const centralSize = centrals.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const total = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function colLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildSheet(rows: (string | number)[][]): string {
  let xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  rows.forEach((row, ri) => {
    xml += `<row r="${ri + 1}">`;
    row.forEach((val, ci) => {
      const ref = `${colLetter(ci)}${ri + 1}`;
      if (typeof val === "number") {
        xml += `<c r="${ref}"><v>${val}</v></c>`;
      } else {
        xml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(val)}</t></is></c>`;
      }
    });
    xml += "</row>";
  });
  xml += "</sheetData></worksheet>";
  return xml;
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  "</Types>";

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";

const WORKBOOK =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Aufmass" sheetId="1" r:id="rId1"/></sheets></workbook>';

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  "</Relationships>";

export const XLSX_HEADER = ["Objekt", "Geschoss", "Raum", "Element", "Formel", "Ergebnis", "Einheit"];

export function zeilenToXlsx(zeilen: AufmassZeile[]): Uint8Array {
  const rows: (string | number)[][] = [XLSX_HEADER];
  for (const z of zeilen) rows.push([z.objekt, z.geschoss, z.raum, z.element, z.formel, z.ergebnis, z.einheit]);
  const sheet = buildSheet(rows);
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: enc.encode(WORKBOOK) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(WORKBOOK_RELS) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheet) },
  ]);
}
