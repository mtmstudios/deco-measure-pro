## Ziel

Räume und ihre Unter-Daten (Öffnungen, Heizkörper, Acryl, Leistungen, Teilflächen) lassen sich ohne Internet vollständig erfassen. Bei wiederkehrender Verbindung wird alles im Hintergrund automatisch synchronisiert.

## Architektur-Entscheidung (wichtig)

Der Raum-Wizard schreibt heute in **6 Schritten** direkt in Supabase — jeder Step liest die frisch vergebene `raum.id`/`oeffnung.id` zurück und hängt die nächste Tabelle daran. Das funktioniert offline nicht: ohne Server keine echten IDs.

**Vorgeschlagene Lösung:** Client-generierte UUIDs + „Entwurfs-Modus" für Räume.

- Neu angelegte Räume bekommen sofort eine lokale UUID (`crypto.randomUUID()`).
- Solange der Raum als *Entwurf* markiert ist, laufen ALLE Änderungen (raum + alle Unter-Tabellen) in einen lokalen IndexedDB-Cache.
- Beim Klick auf „Abschließen" wird ein einziger **Snapshot** des Raums in die Queue gelegt — ein Payload, ein Sync-Vorgang.
- Bereits synchronisierte Räume werden weiterhin online-first bearbeitet (mit Fallback in die Queue bei Ausfall).

Vorteil: Kein Schema-Umbau, keine ID-Rewrites, kein Konflikt-Management auf Feldebene.

## Umfang

**1) IndexedDB-Schicht (`src/lib/offline-db.ts`)**
- Store `raum_draft`: kompletter Raum-Zustand pro Entwurf (raum + teilflaechen + oeffnungen + heizkoerper + acryl + leistungen).
- Store `queue`: FIFO ausstehender Sync-Aufträge (`{ id, kind: "raum_upsert", payload, attempts, lastError, createdAt }`).
- Nutzt `idb` (bereits leichtgewichtige Bibliothek, ~1 KB) oder eigener dünner Wrapper.

**2) Sync-Engine (`src/lib/offline-sync.ts`)**
- `enqueue(job)` – legt Job an, feuert `drain()`.
- `drain()` – arbeitet Queue seriell ab; Retry mit exponentiellem Backoff (max. 5 Versuche); bei permanentem Fehler bleibt Job in Queue mit `lastError`.
- Trigger: App-Start, `online`-Event, `visibilitychange` (zurück in Vordergrund), manueller Sync-Button, Auto-Sync-Intervall (30 s).
- Ein Job = ein Raum-Upsert per Supabase-RPC `upsert_raum_snapshot(payload jsonb)` (neue DB-Funktion, transaktional).

**3) DB-Migration**
- Neue Funktion `public.upsert_raum_snapshot(p jsonb)`: löscht/ersetzt Unter-Tabellen des Raums und schreibt Raum-Felder – als eine Transaktion, RLS-sicher (prüft `betrieb_id`).
- Kein Schema-Change an bestehenden Tabellen.

**4) Wizard-Anpassung (`projekt.$id.raum.$raumId.tsx`)**
- Statt Step-für-Step direkt zu speichern, wird in den lokalen Draft-Store geschrieben.
- „Abschließen" ruft `enqueue({ kind: "raum_upsert", payload: draft })`.
- Beim Öffnen eines Raums: erst Draft-Store prüfen, sonst vom Server laden und in den Store spiegeln.

**5) UI-Signale**
- Einstellungen → Sync-Karte zeigt „X Änderungen ausstehend" mit Pending-Count.
- Projekt-Detail: Pending-Pill am Raum („Wird synchronisiert" / „Wartet auf Netz").
- Toast bei erfolgreicher Übertragung; Fehler-Banner falls Job dauerhaft scheitert.

**6) Service-Worker (minimal)**
- Existierender PWA-Manifest bleibt; ein simpler SW cached App-Shell für Offline-Öffnen. Kein komplexes Runtime-Caching.

## Bewusst nicht enthalten

- Offline-**Anlegen neuer Projekte** (nur Räume/Aufmaße innerhalb bestehender Projekte).
- Offline-Foto-Upload (Fotos brauchen Storage-Bucket und Chunk-Handling — separates Thema).
- Mehrgeräte-Konflikte (zwei Geräte bearbeiten denselben Raum offline). Last-write-wins ist akzeptiert.
- Übergabe/Vorschau offline (die brauchen aktuelle Server-Daten).

## Aufwand

Mittleres bis großes Feature — betrifft Wizard-Datenflow, neue DB-Funktion, IndexedDB-Layer, Sync-Loop und mehrere UI-Stellen. Rechne mit deutlich mehr Code als die letzten Iterationen.

## Frage zurück

Passt der „Snapshot-pro-Raum"-Ansatz (einfach, robust, letzter Stand gewinnt), oder brauchst du feingranulare Operations-Queue mit optimistischer ID-Vergabe pro Unter-Zeile (aufwendiger, aber Verlust einzelner Feldänderungen wird unwahrscheinlicher)?