# MHZ Preis-Extractor

Hält die Preislisten der Aufmaß-App aktuell. Statt Matrizen von Hand abzutippen,
wird die Breite×Höhe-Preismatrix eines Modells **koordinatenbasiert** aus dem
MHZ-PDF extrahiert und als fertiger TypeScript-`Produkt`-Block ausgegeben —
inklusive Selbst-Verifikation (Vollständigkeit + Monotonie).

Kein Teil des App-Builds (liegt außerhalb `src/`). Reines Entwickler-Werkzeug.

## Setup (einmalig)

```bash
pip install -r requirements.txt   # PyMuPDF
```

Die MHZ-Preislisten liegen als ZIP im übergeordneten Projektordner
(`../../../preislisten/…`) — das ist der Default. Alternativ `--pdf <pfad>`.

## Neue Preisliste oder neues Modell — Ablauf

1. **Seiten des Modells finden:**
   ```bash
   python3 mhz_extract.py --find "11-8130" --pdf "MHZ Preise 25/Plissee_25.pdf"
   ```
   (oder mit einem bereits eingetragenen Modell: `--find "11-8130" 11-8130`)

2. **Modell in `MODELS` eintragen** (in `mhz_extract.py`): `pages` (1-basiert,
   inklusive), `min_breite`/`min_hoehe`, `pendel` (falls Pendelsicherungs-Spalte),
   `zuschlaege_extra` (feste Aufpreise). Vorlage: der `11-8130`-Eintrag.

3. **Extrahieren + prüfen:**
   ```bash
   python3 mhz_extract.py 11-8130 --out block.ts
   ```
   stderr zeigt Breiten-/Höhenraster, Pendelsicherung, **Lücken** und
   **Monotonie-Verletzungen**. Bei Problemen bricht das Tool ab (Exit 2) und der
   Block darf **nicht** verwendet werden.

4. **Gegen das PDF-Bild prüfen** (Pflicht bei neuem Modell — Zahlen stichprobenartig
   an den Rändern vergleichen):
   ```bash
   python3 -c "import fitz; fitz.open('<pdf>')[42].get_pixmap(matrix=fitz.Matrix(2,2)).save('s.png')"
   ```

5. **TS-Block einbauen:** Inhalt von `block.ts` in `src/lib/preis-data.ts` einfügen
   und den Const-Namen zu `MHZ_PRODUKTE` hinzufügen. Danach **spiegeln** nach
   `aufmass-engine/src/preis-data.ts` (beide Dateien sind identisch bis auf die
   Import-Zeile). Sync prüfen:
   ```bash
   norm(){ grep -vE '^\s*(//|\*|/\*|import |$)' "$1" | sed 's/[[:space:]]\+/ /g'; }
   diff <(norm src/lib/preis-data.ts) <(norm ../aufmass-engine/src/preis-data.ts)
   ```

## Abgedeckte Layout-Familie

Plissee/Duette-Stil: **N Breiten-Gruppen je Band, je Gruppe 5 Preisgruppen**
(PG A/1/2/3/4), Höhen als Zeilen links, optional eine höhenabhängige
Aufpreisspalte rechts (Pendelsicherung). Auto-Erkennung der Bänder/Gruppen (5/10/15
PG-Spalten je Band).

Andere Produktfamilien (Rollo, Vertikal-Jalousien/Lamellen, Rollladen) haben
abweichende Layouts und brauchen ggf. eine angepasste `extract_band`-Variante —
der Kern (Verifikation, TS-Ausgabe, CLI) bleibt gleich.

## Selbsttest

`11-8130` ist der Referenz-Eintrag. Sein Output muss die in `preis-data.ts`
committeten Werte exakt reproduzieren (95 Matrixzeilen, 0 Lücken, 0
Monotonie-Verletzungen) — Regressions-Absicherung nach Änderungen am Tool.
