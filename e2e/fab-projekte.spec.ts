import { test, expect } from "@playwright/test";

/**
 * Regression: Der „Neuer Auftrag"-FAB auf /projekte muss
 *  1) `position: fixed` haben und beim Scrollen am Viewport kleben,
 *  2) immer oberhalb der Bottom-Nav sitzen (kein Overlap),
 *  3) niemals eine Projektkarte verdecken (FAB.top >= letzte Karte.bottom
 *     wenn ans Listenende gescrollt wird — dafür sorgt `pb-24`).
 *
 * Die Seite ist auth-geschützt. Der Test nutzt die in der Lovable-Sandbox
 * eingespeisten Supabase-Session-Variablen. Ohne Session wird der Test
 * übersprungen, damit CI ohne Login-Kontext nicht rot wird.
 */

const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const COOKIES_JSON = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;

test.describe("Projekte FAB", () => {
  test.skip(
    !STORAGE_KEY || !SESSION_JSON,
    "Keine Supabase-Session in env — auth-geschützte Route nicht erreichbar.",
  );

  test.beforeEach(async ({ context, page }) => {
    if (COOKIES_JSON) {
      const cookies = JSON.parse(COOKIES_JSON).map((c: Record<string, unknown>) => ({
        ...c,
        url: "http://localhost:8080",
      }));
      await context.addCookies(cookies);
    }
    await page.goto("/");
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [STORAGE_KEY!, SESSION_JSON!],
    );
  });

  test("FAB bleibt fixed beim Scrollen und verdeckt keine Karten", async ({ page }) => {
    await page.goto("/projekte");
    await page.waitForLoadState("networkidle");

    const fab = page.getByRole("button", { name: "Neuer Auftrag" });
    await expect(fab).toBeVisible();

    // 1) position: fixed
    const position = await fab.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe("fixed");

    // 2) Geometrie vor dem Scrollen
    const before = await fab.boundingBox();
    expect(before).not.toBeNull();

    const nav = page.locator("nav.fixed");
    const navBoxBefore = await nav.boundingBox();
    expect(navBoxBefore).not.toBeNull();

    // FAB vollständig über der Nav
    expect(before!.y + before!.height).toBeLessThanOrEqual(navBoxBefore!.y);

    // 3) Bis ans Listenende scrollen — FAB-Koordinaten dürfen sich nicht ändern.
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(200);

    const after = await fab.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);

    // 4) Kein Overlap mit der letzten sichtbaren Karte am Listenende.
    const cardCount = await page.locator('a[href^="/projekt/"]').count();
    if (cardCount > 0) {
      const lastCard = page.locator('a[href^="/projekt/"]').last();
      const cardBox = await lastCard.boundingBox();
      if (cardBox) {
        const overlapsHorizontally =
          after!.x < cardBox.x + cardBox.width &&
          after!.x + after!.width > cardBox.x;
        const overlapsVertically =
          after!.y < cardBox.y + cardBox.height &&
          after!.y + after!.height > cardBox.y;
        expect(
          overlapsHorizontally && overlapsVertically,
          "FAB darf die letzte Karte nicht überlagern (pb-24 muss greifen)",
        ).toBe(false);
      }
    }

    // 5) Visueller Snapshot zum Vergleich bei künftigen Regressionen.
    await expect(page).toHaveScreenshot("projekte-fab-scrolled.png", {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('a[href^="/projekt/"]')], // dynamische Daten ausblenden
    });
  });
});
