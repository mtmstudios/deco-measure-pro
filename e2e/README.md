# E2E Tests

Playwright-Tests für die Aufmaß-App.

## Ausführen

```bash
# Dev-Server muss auf http://localhost:8080 laufen (bun run dev)
bunx playwright test

# Nur einen Test
bunx playwright test e2e/fab-projekte.spec.ts

# Visuellen Snapshot neu generieren (nach gewollten UI-Änderungen)
bunx playwright test --update-snapshots
```

## Auth

Auth-geschützte Routen brauchen eine Supabase-Session in den
Env-Variablen `LOVABLE_BROWSER_SUPABASE_STORAGE_KEY`,
`LOVABLE_BROWSER_SUPABASE_SESSION_JSON` und optional
`LOVABLE_BROWSER_SUPABASE_COOKIES_JSON`. Ohne diese überspringt der Test
sich selbst (`test.skip`), damit CI ohne Login-Kontext nicht rot wird.
