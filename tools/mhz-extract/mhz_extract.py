#!/usr/bin/env python3
"""
MHZ Preis-Extractor — Preislisten aktuell halten (Deco & More Aufmaß-App).

Liest eine MHZ-Preisliste (PDF), extrahiert die Breite×Höhe-Preismatrix eines
Modells KOORDINATENBASIERT (nicht per Textreihenfolge) und gibt einen fertigen
TypeScript-`Produkt`-Block für src/lib/preis-data.ts aus — inklusive Selbst-
Verifikation (Vollständigkeit + Monotonie).

Deckt die Plissee/Duette-Layout-Familie ab: N Breiten-Gruppen je Band, je Gruppe
5 Preisgruppen (PG A/1/2/3/4), Höhen als Zeilen links, optional eine
höhenabhängige Aufpreisspalte rechts (z. B. Pendelsicherung).

NEUE PREISLISTE / NEUES MODELL — Ablauf:
  1. PDF aus der Preislisten-ZIP holen (oder --pdf direkt angeben).
  2. Seiten des Modells finden:  python3 mhz_extract.py --find "11-8130" --pdf <pdf>
  3. Modell in MODELS unten eintragen (pages, min-Maße, Aufpreise …).
  4. Extrahieren + prüfen:       python3 mhz_extract.py 11-8130 > block.ts
  5. TS-Block in src/lib/preis-data.ts einfügen + zu MHZ_PRODUKTE hinzufügen,
     danach in aufmass-engine/src/preis-data.ts spiegeln (nur Import unterscheidet sich).

Voraussetzung: PyMuPDF  →  pip install pymupdf
"""

import argparse
import os
import re
import sys
import tempfile
import zipfile

import fitz  # PyMuPDF

# Preislisten-ZIP liegt im übergeordneten Projektordner (nicht im App-Repo).
DEFAULT_ZIP = os.path.normpath(
    os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "preislisten",
        "MHZ-Preise-2025_von-Nicole-2026-07-09.zip",
    )
)

# ---------------------------------------------------------------------------
# Modell-Registry: ein Eintrag je Modell. Neues Modell = neuer Eintrag.
# ---------------------------------------------------------------------------
MODELS = {
    "11-8130": dict(
        pdf_in_zip="MHZ Preise 25/Plissee_25.pdf",
        pages=(43, 46),  # 1-basiert, inklusive
        produkt="Plissee",
        modell="11-8130",
        gruppen_label="Stoffgruppe",
        pg_labels=["A", "1", "2", "3", "4"],
        min_breite=35,
        min_hoehe=30,
        pendel=dict(code="PENDELSICHERUNG", name="Pendelsicherung"),
        zuschlaege_extra=[
            dict(code="METALLKETTE", name="Metallkette (statt Schnur)", typ="fix", wert=23.90),
        ],
        quelle="MHZ Preisliste 2025, Plissee_25.pdf S. 43–46",
        note="freihängend, Kettenzug; =11-8140 Elektro",
    ),
}

# ---------------------------------------------------------------------------
# PDF-Helfer
# ---------------------------------------------------------------------------
def _num(t):
    return re.fullmatch(r"\d{2,4}", t) is not None


def _cx(w):
    return (w[0] + w[2]) / 2


def _cy(w):
    return (w[1] + w[3]) / 2


def open_pdf(cfg, zip_path, pdf_path):
    """PDF öffnen — entweder direkt (--pdf) oder aus der ZIP entpacken."""
    if pdf_path:
        return fitz.open(pdf_path), None
    name = cfg["pdf_in_zip"]
    tmp = tempfile.mkdtemp(prefix="mhz_")
    with zipfile.ZipFile(zip_path) as z:
        z.extract(name, tmp)
    return fitz.open(os.path.join(tmp, name)), tmp


def find_pages(doc, needle):
    hits = [i + 1 for i in range(doc.page_count) if needle in doc[i].get_text()]
    return hits


def extract_band(page, hy, header_ys, pg_count, pendel):
    """Ein Band (Kopfzeile bei y=hy) → Liste (breite, pg_label_index, werte[])."""
    W = page.get_text("words")
    pgtok = [w for w in W if w[4] == "PG"]
    cols = sorted(_cx(w) for w in pgtok if abs(w[1] - hy) < 3)
    if len(cols) == 0 or len(cols) % pg_count != 0:
        return None, None
    groups = [cols[i:i + pg_count] for i in range(0, len(cols), pg_count)]

    # Breiten-Wert je Gruppe: numerischer Token knapp über der PG-Kopfzeile.
    widths = []
    for g in groups:
        lo, hi = g[0] - 14, g[-1] + 14
        cand = [w for w in W if hy - 24 < w[1] < hy - 4 and lo < _cx(w) < hi and _num(w[4])]
        widths.append(int(cand[0][4]) if cand else None)

    # Höhen-Zeilen: linke Label-Spalte (x-Zentrum < 95), Werte 30..400.
    nxt = [h for h in header_ys if h > hy]
    y_lo, y_hi = hy + 8, (nxt[0] - 24 if nxt else hy + 300)
    hrows = sorted(
        (_cy(w), int(w[4]))
        for w in W
        if _cx(w) < 95 and y_lo < _cy(w) < y_hi and _num(w[4]) and 30 <= int(w[4]) <= 400
    )

    def price_at(colx, rowy):
        best, bd = None, 1e9
        for w in W:
            if _num(w[4]) and abs(_cx(w) - colx) < 8 and abs(_cy(w) - rowy) < 5:
                d = abs(_cx(w) - colx) + abs(_cy(w) - rowy)
                if d < bd:
                    bd, best = d, int(w[4])
        return best

    rows = []
    for gi, g in enumerate(groups):
        for pgi, colx in enumerate(g):
            rows.append((widths[gi], pgi, [price_at(colx, ry) for ry, _ in hrows]))

    pend = {}
    if pendel:
        pend_x0 = groups[-1][-1] + 15  # rechts der letzten Gruppe
        for ry, hv in hrows:
            cand = [
                int(w[4])
                for w in W
                if re.fullmatch(r"\d{2,3}", w[4]) and _cx(w) > pend_x0 and abs(_cy(w) - ry) < 5
            ]
            if cand:
                pend[hv] = cand[0]
    return dict(hrows=hrows, rows=rows), pend


def extract(doc, cfg):
    p0, p1 = cfg["pages"]
    pg_count = len(cfg["pg_labels"])
    D, heights, pend = {}, None, {}
    for pno in range(p0 - 1, p1):
        page = doc[pno]
        header_ys = sorted(set(round(w[1], 0) for w in page.get_text("words") if w[4] == "PG"))
        for hy in header_ys:
            band, bpend = extract_band(page, hy, header_ys, pg_count, cfg.get("pendel"))
            if band is None:
                continue
            if heights is None:
                heights = [h for _, h in band["hrows"]]
            for width, pgi, vals in band["rows"]:
                D[(width, pgi)] = vals
            pend.update(bpend)
    widths = sorted(set(w for w, _ in D))
    return D, widths, heights, [pend.get(h) for h in heights] if pend else None


# ---------------------------------------------------------------------------
# Verifikation
# ---------------------------------------------------------------------------
def verify(D, widths, heights, pg_count):
    problems = []
    for (w, pgi), vals in D.items():
        if len(vals) != len(heights) or any(v is None for v in vals):
            problems.append(f"Spalte Breite {w} PG{pgi}: fehlende Werte")
    idx = {h: i for i, h in enumerate(heights)}
    cell = lambda w, pgi, h: D[(w, pgi)][idx[h]]
    viol = 0
    for (w, pgi), vals in D.items():
        viol += sum(1 for i in range(1, len(vals)) if vals[i] < vals[i - 1])
    for pgi in range(pg_count):
        for h in heights:
            row = [cell(w, pgi, h) for w in widths]
            viol += sum(1 for i in range(1, len(row)) if row[i] < row[i - 1])
    for w in widths:
        for h in heights:
            seq = [cell(w, pgi, h) for pgi in range(pg_count)]
            viol += sum(1 for i in range(1, len(seq)) if seq[i] <= seq[i - 1])
    return problems, viol


# ---------------------------------------------------------------------------
# TypeScript-Ausgabe
# ---------------------------------------------------------------------------
def build_ts(cfg, D, widths, heights, pend):
    pg_labels = cfg["pg_labels"]
    idx = {h: i for i, h in enumerate(heights)}
    cell = lambda w, pgi, h: D[(w, pgi)][idx[h]]
    brs = "[" + ", ".join(str(w) for w in widths) + "]"
    hrs = "[" + ", ".join(str(h) for h in heights) + "]"

    L = []
    L.append("/**")
    L.append(f" * ECHTE MHZ-Preisdaten — {cfg['produkt']} Modell {cfg['modell']}"
             + (f" ({cfg['note']})." if cfg.get("note") else "."))
    L.append(f" * Quelle: {cfg['quelle']}. UVP inkl. MwSt. in EUR.")
    L.append(" * Extrahiert & verifiziert mit tools/mhz-extract (Vollständigkeit + Monotonie).")
    L.append(" */")
    name = f"MHZ_{cfg['produkt'].upper()}_{cfg['modell'].replace('-', '_')}"
    L.append(f"export const {name}: Produkt = {{")
    L.append('  hersteller: "MHZ",')
    L.append(f'  produkt: "{cfg["produkt"]}",')
    L.append(f'  gruppen_label: "{cfg["gruppen_label"]}",')
    L.append(f'  modell: "{cfg["modell"]}",')
    L.append('  preisbasis: "UVP inkl. MwSt.",')
    L.append(f"  mindest_breite_cm: {cfg['min_breite']},")
    L.append(f"  mindest_hoehe_cm: {cfg['min_hoehe']},")
    L.append("  preisgruppen: [")
    for pgi, lbl in enumerate(pg_labels):
        code = "PG" + ("A" if lbl == "A" else lbl)
        L.append("    {")
        L.append(f'      code: "{code}",')
        L.append(f'      name: "Preisgruppe {lbl}",')
        L.append("      raster: {")
        L.append(f"        breiten_cm: {brs},")
        L.append(f"        hoehen_cm: {hrs},")
        L.append("        matrix: [")
        for h in heights:
            vals = [cell(w, pgi, h) for w in widths]
            L.append("      [" + ", ".join(f"{v:5d}" for v in vals) + "],")
        L.append("        ],")
        L.append("      },")
        L.append("    },")
    L.append("  ],")

    zus = []
    if pend and cfg.get("pendel"):
        pd = cfg["pendel"]
        werte = ", ".join(str(v) for v in pend)
        zus.append(
            f'    {{ code: "{pd["code"]}", name: "{pd["name"]}", typ: "hoehe_tabelle", '
            f"wert: {min(pend)}, hoehen_werte: [{werte}] }},"
        )
    for z in cfg.get("zuschlaege_extra", []):
        zus.append(
            f'    {{ code: "{z["code"]}", name: "{z["name"]}", typ: "{z["typ"]}", wert: {z["wert"]} }},'
        )
    if zus:
        L.append("  zuschlaege: [")
        L.extend(zus)
        L.append("  ],")
    L.append("};")
    return "\n".join(L) + "\n"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="MHZ Preis-Extractor")
    ap.add_argument("model", nargs="?", help="Modell-Key aus MODELS, z. B. 11-8130")
    ap.add_argument("--zip", default=DEFAULT_ZIP, help="Preislisten-ZIP")
    ap.add_argument("--pdf", help="PDF direkt (statt aus ZIP)")
    ap.add_argument("--find", help="Seiten mit diesem Text suchen (braucht --pdf oder --zip+Modell)")
    ap.add_argument("--out", help="TS-Block in Datei schreiben (statt stdout)")
    args = ap.parse_args()

    if args.find:
        if not args.model and not args.pdf:
            ap.error("--find braucht ein Modell (für die PDF-in-ZIP) oder --pdf")
        cfg = MODELS.get(args.model, {"pdf_in_zip": None})
        doc, _ = open_pdf(cfg, args.zip, args.pdf)
        print("Seiten mit", repr(args.find), "→", find_pages(doc, args.find), file=sys.stderr)
        return

    if args.model not in MODELS:
        ap.error(f"Modell '{args.model}' nicht in MODELS. Bekannt: {', '.join(MODELS)}")
    cfg = MODELS[args.model]
    doc, _ = open_pdf(cfg, args.zip, args.pdf)
    D, widths, heights, pend = extract(doc, cfg)

    problems, viol = verify(D, widths, heights, len(cfg["pg_labels"]))
    print(f"[{cfg['modell']}] Breiten {widths[0]}–{widths[-1]} ({len(widths)}), "
          f"Höhen {heights[0]}–{heights[-1]} ({len(heights)}), "
          f"Spalten {len(D)}", file=sys.stderr)
    if pend:
        print(f"[{cfg['modell']}] Pendelsicherung: {pend}", file=sys.stderr)
    print(f"[{cfg['modell']}] Lücken: {len(problems)}, Monotonie-Verletzungen: {viol}",
          file=sys.stderr)
    if problems:
        for p in problems[:8]:
            print("   ", p, file=sys.stderr)
    if problems or viol:
        print("‼ VERIFIKATION FEHLGESCHLAGEN — Ausgabe NICHT verwenden.", file=sys.stderr)
        sys.exit(2)
    print(f"[{cfg['modell']}] ✓ verifiziert", file=sys.stderr)

    ts = build_ts(cfg, D, widths, heights, pend)
    if args.out:
        open(args.out, "w").write(ts)
        print(f"[{cfg['modell']}] TS-Block → {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(ts)


if __name__ == "__main__":
    main()
