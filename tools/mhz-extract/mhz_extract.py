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
PREISLISTEN_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "preislisten")
)
DEFAULT_ZIP = os.path.join(PREISLISTEN_DIR, "MHZ-Preise-2025_von-Nicole-2026-07-09.zip")

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
# Rollo (Rollo-25.pdf) — 6 Preisgruppen PG A/1–5, breitenabhängige Aufpreise
# unter jeder Matrix. Eine Matrix gilt je Serie für mehrere Modelle; die
# Bedienvariante (Soft/Kurbel/Elektro/Akku) ist ein Aufpreis p. Anlage/p. St.
# ---------------------------------------------------------------------------
def _fix(code, name, wert):
    return dict(code=code, name=name, typ="fix", wert=wert)


_ROLLO = dict(
    pdf_in_zip="MHZ Preise 25/Rollo-25.pdf",
    produkt="Rollo",
    gruppen_label="Stoffgruppe",
    pg_labels=["A", "1", "2", "3", "4", "5"],
)
_BEF = dict(code="BEFESTIGUNGSSCHIENE", name="Befestigungsschiene", label="Befestigungs")
# Label teils dreizeilig ("Außen-/liegender/Fallstab") → Wert liegt bis ~10 pt tiefer.
_FALL = dict(code="FALLSTAB_AUSSEN", name="Außenliegender Fallstab", label="Außen", dy=12)
_KETTEN = [
    _fix("KETTE_ANTIBAKT", "Kette antibakteriell", 8.10),
    _fix("METALLKETTE_SILBER", "Metallkette silber", 14.80),
    _fix("METALLKETTE_BRONZE", "Metallkette bronze/schwarz", 25.00),
]
_R03_MOTOREN = [
    _fix("SONESSE40_WT", "Elektro 230 V: Sonesse 40 WT 3/30", 241.20),
    _fix("SONESSE40_RTS", "Elektro 230 V: Funk Sonesse 40 RTS 3/30", 354.60),
    _fix("SONESSE40_IO", "Elektro 230 V: Funk Sonesse 40 io 3/30", 354.60),
    _fix("SOMFY_SET1", "Akku: Somfy Set 1 (Sonesse Ultra 30 RTS)", 246.80),
    _fix("SOMFY_SET2", "Akku: Somfy Set 2 (+ Situo 1 RTS)", 264.50),
    _fix("SOMFY_SET3", "Akku: Somfy Set 3 (+ Situo 5 RTS II)", 351.50),
    _fix("SOMFY_SET4", "Akku: Somfy Set 4 (RollUp 28 RTS WF)", 156.50),
    _fix("SOMFY_SET5", "Akku: Somfy Set 5 (Set 4 + Situo 1 RTS)", 174.00),
    _fix("SOMFY_SET6", "Akku: Somfy Set 6 (Set 4 + Situo 5 RTS II)", 260.90),
    _fix("POWERVIEW_SET1", "Akku: PowerView Gen. 3 Set 1", 212.20),
    _fix("POWERVIEW_SET2", "Akku: PowerView Gen. 3 Set 2 (+ Pebble)", 322.40),
]
_R04_MOTOREN = [
    _fix("SONESSE50_6", "Elektro 230 V bis 400 cm: Sonesse 50 6/28", 251.50),
    _fix("SONESSE50_6_RTS", "Elektro 230 V bis 400 cm: Funk Sonesse RTS 50 6/28", 348.00),
    _fix("SUNEA50_6_IO", "Elektro 230 V bis 400 cm: Funk Sunea Screen 50 io 6/32", 292.50),
    _fix("SONESSE50_10", "Elektro 230 V ab 400,1 cm: Sonesse 50 10/28", 325.00),
    _fix("SONESSE50_10_RTS", "Elektro 230 V ab 400,1 cm: Funk Sonesse RTS 50 10/28", 376.50),
    _fix("SUNEA50_10_IO", "Elektro 230 V ab 400,1 cm: Funk Sunea Screen 50 io 10/32", 306.50),
]
_Q_ROLLO = "MHZ Preisliste Rollo 2025, Rollo-25.pdf"

MODELS.update({
    "04-3302": dict(
        _ROLLO, modell="04-3302", pages=(17, 18), min_breite=19,
        breite_zuschlaege=[_BEF, _FALL],
        zuschlaege_extra=[
            _fix("SOFT", "Soft-Bedienung (= Modell 04-3303)", 25.90),
            _fix("GETEILT", "Geteilter Behang", 30.70),
            *_KETTEN,
            _fix("PENDELSICHERUNG", "Pendelsicherung", 26.20),
            *_R03_MOTOREN,
        ],
        quelle=f"{_Q_ROLLO} S. 17–18",
        note="R_03 Träger, Kette; gilt auch für 04-3303 Soft, 04-3304 Elektro, 04-3305 Akku",
    ),
    "04-3300": dict(
        _ROLLO, modell="04-3300", pages=(21, 22), min_breite=19,
        breite_zuschlaege=[_BEF, _FALL],
        zuschlaege_extra=[*_KETTEN, _fix("PENDELSICHERUNG", "Pendelsicherung", 26.20)],
        quelle=f"{_Q_ROLLO} S. 21–22",
        note="R_03.BASIC Träger, Kette",
    ),
    "04-3342": dict(
        _ROLLO, modell="04-3342", pages=(25, 26),
        breite_zuschlaege=[_FALL],
        # Höhenabhängige Spalte rechts (Symbol Kassette mit Schiene; "Soft: ohne Seitenführungsschiene")
        pendel=dict(code="SEITENFUEHRUNG", name="Seitenführungsschienen"),
        zuschlaege_extra=[
            _fix("SOFT", "Soft-Bedienung", 25.90),
            _fix("KURBEL", "Kurbel (= Modell 04-3346)", 98.20),
            _fix("GETEILT", "Geteilter Behang", 30.70),
            *_KETTEN,
            _fix("PENDELSICHERUNG", "Pendelsicherung", 26.20),
            *_R03_MOTOREN,
        ],
        quelle=f"{_Q_ROLLO} S. 25–26",
        note="R_03 Kassette; gilt auch für 04-3343/3344/3345/3346",
    ),
    "04-3352": dict(
        _ROLLO, modell="04-3352", pages=(29, 30), min_breite=22.5,
        zuschlaege_extra=[
            _fix("KURBEL", "Kurbel (= Modell 04-3356)", 98.20),
            *_KETTEN,
            _fix("BUERSTENDICHTUNG", "Bürstendichtung", 6.20),
            *_R03_MOTOREN,
        ],
        quelle=f"{_Q_ROLLO} S. 29–30",
        note="R_03 Kassette mit Seitenführungsschienen; gilt auch für 04-3354/3355/3356",
    ),
    "04-3402": dict(
        _ROLLO, modell="04-3402", pages=(43, 46), min_breite=27,
        breite_zuschlaege=[_BEF, _FALL],
        zuschlaege_extra=[*_KETTEN, *_R04_MOTOREN],
        quelle=f"{_Q_ROLLO} S. 43–46",
        note="R_04 Träger, Objektkette; gilt auch für 04-3404 Elektro",
    ),
    "04-3442": dict(
        _ROLLO, modell="04-3442", pages=(49, 52),
        breite_zuschlaege=[_FALL],
        pendel=dict(code="SEITENFUEHRUNG", name="Seitenführungsschienen"),
        zuschlaege_extra=[
            _fix("KURBEL", "Kurbel", 98.20),
            _fix("KURBELHALTERUNG", "Kurbelhalterung (ab Kurbellänge 280 cm)", 25.20),
            *_KETTEN,
            _fix("BUERSTENDICHTUNG", "Bürstendichtung", 6.20),
            *_R04_MOTOREN,
        ],
        quelle=f"{_Q_ROLLO} S. 49–52",
        note="R_04 Kassette; gilt auch für 04-3444 Elektro, 04-3446 Kurbel",
    ),
    "04-3464": dict(
        _ROLLO, modell="04-3464", pages=(57, 59), min_breite=100,
        zuschlaege_extra=[
            _fix("MAESTRIA50_WT", "Motor mit Hinderniserkennung: Maestria 50 WT 6/17", 240.50),
            _fix("MAESTRIA50_IO", "Motor mit Hinderniserkennung: Funk Maestria 50+ io 6/17", 308.00),
        ],
        quelle=f"{_Q_ROLLO} S. 57–59",
        note="R_04 Kassette ZIP, Elektroantrieb 230 V",
    ),
    "04-3504": dict(
        _ROLLO, modell="04-3504", pages=(75, 82),
        breite_zuschlaege=[_FALL],
        zuschlaege_extra=[*_R04_MOTOREN],
        quelle=f"{_Q_ROLLO} S. 75–82",
        note="R_05 Träger, Elektroantrieb",
    ),
})

# ---------------------------------------------------------------------------
# Lamellenvorhänge / Vertikal-Jalousien — NEUE Liste Ausgabe 2026, gültig ab
# 14.09.2026 (MHZ-Kundeninfo, von Nicole per Mail). Eine Matrix je Lamellenbreite.
# Höhenraster endet bei 300 cm ("+ je 20 cm" darüber ist nicht abgebildet).
# ---------------------------------------------------------------------------
_LAMELLE = dict(
    pdf_file="MHZ-Lamellenvorhaenge-2026_gueltig-ab-2026-09-14.pdf",
    produkt="Lamellenvorhang",
    gruppen_label="Preisgruppe",
    pg_labels=["A", "1", "2", "3", "4", "5"],
    min_breite=20,
)
_BIEGUNG = dict(code="BIEGUNG", name="Aufpreis Biegung (gebogene Anlage)", label="Biegung")
_GESPANNT = dict(code="GESPANNT", name="Gespannte Anlage", label="Gespannte")
_LAM_ELEKTRO = [
    _fix("ELEKTRO_230", "Elektroantrieb 230 V", 408.30),
    _fix("RTS_230", "RTS Elektro-Funkantrieb 230 V", 529.60),
]
_LAM_STD = [
    _fix("BEDIENKETTE_METALL", "Bedienkette aus Metall", 25.00),
    _fix("KETTE_ANTIBAKT", "Kette antibakteriell", 8.10),
]
_Q_LAM = "MHZ Preisliste Lamellenvorhänge Ausgabe 2026 (gültig ab 14.09.2026)"

MODELS.update({
    "05-7227": dict(
        _LAMELLE, modell="05-7227", pages=(12, 22),
        breite_zuschlaege=[_BIEGUNG, _GESPANNT],
        zuschlaege_extra=[
            dict(code="SLOPE", name="Slope-Anlage (= 05-7229)", typ="prozent", wert=25),
            _fix("GETEILT", "Geteilter Behang", 20.00),
            *_LAM_STD,
            _fix("VORKONFEKTIONIERT", "Behang vorkonfektioniert", 24.40),
            _fix("POWERVIEW_SET1", "Akku: PowerView Gen. 3 Set 1", 253.00),
            _fix("POWERVIEW_SET2", "Akku: PowerView Gen. 3 Set 2 (+ Pebble)", 363.20),
            *_LAM_ELEKTRO,
        ],
        quelle=f"{_Q_LAM}, S. 12–22",
        note="127 mm Lamelle; gilt für 05-7827, 05-7227, 05-7229, 05-7232, 05-7234, 05-8127, 05-8827",
    ),
    "05-7289": dict(
        _LAMELLE, modell="05-7289", pages=(26, 36),
        breite_zuschlaege=[_BIEGUNG, _GESPANNT],
        zuschlaege_extra=[
            dict(code="SLOPE", name="Slope-Anlage (= 05-7258)", typ="prozent", wert=25),
            _fix("GETEILT", "Geteilter Behang", 15.10),
            *_LAM_STD,
            _fix("VORKONFEKTIONIERT", "Behang vorkonfektioniert", 24.40),
            _fix("POWERVIEW_SET1", "Akku: PowerView Gen. 3 Set 1", 253.00),
            _fix("POWERVIEW_SET2", "Akku: PowerView Gen. 3 Set 2 (+ Pebble)", 363.20),
            *_LAM_ELEKTRO,
        ],
        quelle=f"{_Q_LAM}, S. 26–36",
        note="89 mm Lamelle; gilt für 05-7889, 05-7289, 05-7258, 05-7285, 05-7297, 05-8164, 05-8166",
    ),
    "05-7025": dict(
        _LAMELLE, modell="05-7025", pages=(39, 49),
        breite_zuschlaege=[_BIEGUNG, _GESPANNT],
        zuschlaege_extra=[_fix("GETEILT", "Geteilter Behang", 34.90), *_LAM_STD, *_LAM_ELEKTRO],
        quelle=f"{_Q_LAM}, S. 39–49",
        note="250 mm Lamelle; gilt für 05-7025, 05-7029, 05-7027",
    ),
})

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
    if cfg.get("pdf_file"):  # Einzel-PDF im Preislisten-Ordner (z. B. neue Liste per Mail)
        return fitz.open(os.path.join(PREISLISTEN_DIR, cfg["pdf_file"])), None
    name = cfg["pdf_in_zip"]
    tmp = tempfile.mkdtemp(prefix="mhz_")
    with zipfile.ZipFile(zip_path) as z:
        z.extract(name, tmp)
    return fitz.open(os.path.join(tmp, name)), tmp


def find_pages(doc, needle):
    hits = [i + 1 for i in range(doc.page_count) if needle in doc[i].get_text()]
    return hits


NA = "—"  # Zelle existiert im PDF nicht (Band endet früher) → null = nicht lieferbar


def _cluster(ys, tol=3):
    """Kopfzeilen-y-Werte zusammenfassen (Rundung kann eine Zeile auf 311/312 splitten)."""
    out = []
    for y in sorted(ys):
        if out and y - out[-1] <= tol:
            continue
        out.append(y)
    return out


def extract_band(page, hy, header_ys, pg_count, pendel, breite_zuschlaege=()):
    """Ein Band (Kopfzeile bei y=hy) → Liste (breite, pg_label_index, werte[])."""
    W = page.get_text("words")
    # Gestrichelte Rahmen (z. B. R_04/R_05 ab 340 cm) kleben an Zahlen: "¦1207" → "1207".
    W = [w[:4] + (re.sub(r"^\D+|\D+$", "", w[4]) if re.search(r"\d", w[4]) else w[4],) for w in W]
    pgtok = [w for w in W if w[4] == "PG" and abs(w[1] - hy) < 4]
    cols = sorted(_cx(w) for w in pgtok)
    if len(cols) == 0 or len(cols) % pg_count != 0:
        return None, None, None
    groups = [cols[i:i + pg_count] for i in range(0, len(cols), pg_count)]
    # Label-Spalte = alles links der ersten PG-Spalte (x schwankt je nach Seite).
    label_x_max = min(w[0] for w in pgtok) - 5

    # Breiten-Wert je Gruppe: numerischer Token knapp über der PG-Kopfzeile.
    widths = []
    for g in groups:
        lo, hi = g[0] - 14, g[-1] + 14
        cand = [w for w in W if hy - 24 < w[1] < hy - 4 and lo < _cx(w) < hi and _num(w[4])]
        widths.append(int(cand[0][4]) if cand else None)

    # Höhen-Zeilen: Label-Spalte links der PG-Spalten, Werte 30..800.
    # Abbruch bei Lücke > 20 pt oder nicht steigender Höhe (Fußnoten/Aufpreis-Texte).
    nxt = [h for h in header_ys if h > hy]
    y_lo, y_hi = hy + 8, (nxt[0] - 24 if nxt else hy + 520)
    cand_rows = sorted(
        (_cy(w), int(w[4]))
        for w in W
        if w[2] < label_x_max and y_lo < _cy(w) < y_hi and _num(w[4]) and 30 <= int(w[4]) <= 800
    )
    hrows = []
    for r in cand_rows:
        if hrows and (r[0] - hrows[-1][0] > 20 or r[1] <= hrows[-1][1]):
            break
        hrows.append(r)

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

    # Breitenabhängige Aufpreise (Zeile unter der Matrix, ein Wert je Breiten-Gruppe),
    # erkannt am Label-Text in der linken Spalte, z. B. "Befestigungs…" / "Biegung".
    bz = {}
    last_y = hrows[-1][0] if hrows else hy
    for z in breite_zuschlaege:
        labels = [
            w for w in W
            if w[0] < label_x_max and w[4].startswith(z["label"]) and last_y < _cy(w) < y_hi
        ]
        if not labels:
            continue
        ly = min(_cy(w) for w in labels)
        for gi, g in enumerate(groups):
            lo, hi = g[0] - 14, g[-1] + 14
            vals = sorted(
                (abs(_cy(w) - ly), int(w[4]))
                for w in W
                if _num(w[4]) and lo < _cx(w) < hi and abs(_cy(w) - ly) < z.get("dy", 8)
            )
            bz.setdefault(z["code"], {})[widths[gi]] = vals[0][1] if vals else None
    return dict(hrows=hrows, rows=rows), pend, bz


def extract(doc, cfg):
    p0, p1 = cfg["pages"]
    pg_count = len(cfg["pg_labels"])
    D, heights, pend, BZ = {}, None, {}, {}
    for pno in range(p0 - 1, p1):
        page = doc[pno]
        header_ys = _cluster(round(w[1], 0) for w in page.get_text("words") if w[4] == "PG")
        for hy in header_ys:
            band, bpend, bz = extract_band(
                page, hy, header_ys, pg_count, cfg.get("pendel"), cfg.get("breite_zuschlaege", ())
            )
            if band is None:
                continue
            bh = [h for _, h in band["hrows"]]
            # Große Breiten haben teils eine kleinere Max.-Höhe (Max.-Fläche) → das Band
            # endet früher. Erlaubt ist nur ein Präfix des vollen Rasters.
            if heights and bh != heights[:len(bh)] and heights != bh[:len(heights)]:
                sys.exit(f"‼ S.{pno + 1} Band y={hy}: Höhenraster {bh} passt nicht zu {heights}")
            if heights is None or len(bh) > len(heights):
                heights = bh
            for width, pgi, vals in band["rows"]:
                # Leere Zellen am Spaltenende = Max.-Fläche überschritten (z. B. R_04: 16 m²)
                # → nicht lieferbar. Leere Zellen mitten in der Spalte bleiben None (= Fehler).
                vals = list(vals)
                n = len(vals)
                while n and vals[n - 1] is None:
                    n -= 1
                D[(width, pgi)] = dict(zip(bh[:n], vals[:n]))
            pend.update(bpend)
            for code, m in bz.items():
                BZ.setdefault(code, {}).update(m)
    widths = sorted(set(w for w, _ in D))
    # Höhe fehlt im Band → NA (nicht lieferbar); None bleibt "nicht gelesen" (= Fehler).
    D = {k: [m[h] if h in m else NA for h in heights] for k, m in D.items()}
    bz_out = {code: [m.get(w) for w in widths] for code, m in BZ.items()}
    return D, widths, heights, [pend.get(h) for h in heights] if pend else None, bz_out


# ---------------------------------------------------------------------------
# Verifikation
# ---------------------------------------------------------------------------
def verify(D, widths, heights, pg_count):
    problems = []
    for (w, pgi), vals in D.items():
        if len(vals) != len(heights) or any(v is None for v in vals):
            problems.append(f"Spalte Breite {w} PG{pgi}: fehlende Werte")
    for (w, pgi), vals in D.items():
        real = [v for v in vals if v != NA]
        if vals[:len(real)] != real:
            problems.append(f"Spalte Breite {w} PG{pgi}: Lücke mitten im Raster")
    idx = {h: i for i, h in enumerate(heights)}
    cell = lambda w, pgi, h: D[(w, pgi)][idx[h]]

    def _viol(seq, strict=False):
        s = [v for v in seq if isinstance(v, int)]
        return sum(1 for i in range(1, len(s)) if (s[i] <= s[i - 1] if strict else s[i] < s[i - 1]))

    viol = 0
    for vals in D.values():
        viol += _viol(vals)
    for pgi in range(pg_count):
        for h in heights:
            viol += _viol([cell(w, pgi, h) for w in widths])
    for w in widths:
        for h in heights:
            viol += _viol([cell(w, pgi, h) for pgi in range(pg_count)], strict=True)
    return problems, viol


# ---------------------------------------------------------------------------
# TypeScript-Ausgabe
# ---------------------------------------------------------------------------
def build_ts(cfg, D, widths, heights, pend, bz=None):
    bz = bz or {}
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
    # Mindestmaße nur, wenn MHZ sie angibt (sonst greift das kleinste Raster "bis …").
    if cfg.get("min_breite"):
        L.append(f"  mindest_breite_cm: {cfg['min_breite']},")
    if cfg.get("min_hoehe"):
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
            L.append("      [" + ", ".join(" null" if v == NA else f"{v:5d}" for v in vals) + "],")
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
    for z in cfg.get("breite_zuschlaege", []):
        werte = bz.get(z["code"])
        if werte:
            zus.append(
                f'    {{ code: "{z["code"]}", name: "{z["name"]}", typ: "breite_tabelle", '
                f"wert: {min(v for v in werte if v is not None)}, "
                f"breiten_werte: [{', '.join('null' if v is None else str(v) for v in werte)}] }},"
            )
    for z in cfg.get("zuschlaege_extra", []):
        wert = f'{z["wert"]:.2f}' if z["typ"] == "fix" else z["wert"]
        zus.append(
            f'    {{ code: "{z["code"]}", name: "{z["name"]}", typ: "{z["typ"]}", wert: {wert} }},'
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
    D, widths, heights, pend, bz = extract(doc, cfg)

    problems, viol = verify(D, widths, heights, len(cfg["pg_labels"]))
    for z in cfg.get("breite_zuschlaege", []):
        werte = bz.get(z["code"]) or []
        # Lücken am Ende = Ausführung ab dieser Breite nicht lieferbar (→ null). Mittendrin = Fehler.
        core = list(werte)
        while core and core[-1] is None:
            core.pop()
        if not core or any(v is None for v in core):
            problems.append(f"Breiten-Aufpreis {z['code']}: fehlende Werte {werte}")
        else:
            bis = widths[len(core) - 1]
            print(f"[{cfg['modell']}] {z['code']}: {core} (bis Breite {bis})", file=sys.stderr)
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

    ts = build_ts(cfg, D, widths, heights, pend, bz)
    if args.out:
        open(args.out, "w").write(ts)
        print(f"[{cfg['modell']}] TS-Block → {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(ts)


if __name__ == "__main__":
    main()
