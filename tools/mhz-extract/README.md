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

## Abgedeckte Layouts

Grundmuster: **N Breiten-Gruppen je Band, je Gruppe k Preisgruppen** (`pg_labels`),
Höhen als Zeilen links. Abgedeckt und verifiziert:

| Familie | PDF | PG | Besonderheiten |
|---|---|---|---|
| Plissee/Duette | Plissee_25 / Duette_25 (ZIP) | A,1–4 | `pendel` (höhenabh. Spalte rechts) |
| Rollo R_03/R_04/R_05 | Rollo-25 (ZIP) | A,1–5 | `breite_zuschlaege` (Befestigungsschiene, Fallstab), `pendel` für Seitenführungsschienen, Max.-Fläche → `null` |
| Lamellenvorhänge | Liste 2026 als Einzel-PDF (`pdf_file`) | A,1–5 | `breite_zuschlaege` (Biegung, gespannt) enden ab Max.-Breite → `null` |

Registry-Schlüssel:
- `pdf_in_zip` **oder** `pdf_file` (Einzel-PDF im Preislisten-Ordner, z. B. neue Liste per Mail).
- `breite_zuschlaege`: `[{code, name, label, dy?}]` — Zeile unter der Matrix, erkannt am
  Label-Anfang in der linken Spalte, ein Wert je Breite → `typ: "breite_tabelle"`.
  Fehlende Werte **am Ende** = ab dieser Breite nicht lieferbar (`null`); mittendrin = Fehler.
- `min_breite`/`min_hoehe` optional — nur setzen, wenn MHZ sie angibt.

Robustheit: Label-Spalte relativ zur ersten PG-Spalte, Kopfzeilen-Cluster (±3 pt),
Rahmenzeichen an Zahlen werden entfernt, Höhenraster je Band darf kürzer sein,
leere Zellen am Spaltenende = `null` (nicht lieferbar).

**Nicht abgebildet:** Lamellen-Zeile „+ je 20 cm“ über 300 cm Höhe (Engine meldet
„über Raster“), R_04/R_05 „inkl. Ausgleichsvorrichtung“ (nur Hinweis), Dachfenster-Rollo
(Fenstertyp-Tabelle, eigener Extractor nötig).

## Selbsttest

`11-8130` ist der Referenz-Eintrag. Sein Output muss die in `preis-data.ts`
committeten Werte exakt reproduzieren (95 Matrixzeilen, 0 Lücken, 0
Monotonie-Verletzungen) — Regressions-Absicherung nach Änderungen am Tool.
