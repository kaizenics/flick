import type { Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import { accountSwitcherTrigger, seeAllProfiles } from "./selectors";
import { randomDelay } from "./browser";
import { appendLog } from "../logs";

async function dumpDebug(page: Page, label: string) {
  const debugDir = path.join(process.cwd(), "data", "debug");
  await fs.mkdir(debugDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const shot = path.join(debugDir, `${label}-${stamp}.png`);
  const html = path.join(debugDir, `${label}-${stamp}.html`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  await fs.writeFile(html, await page.content().catch(() => "")).catch(() => {});
  return path.relative(process.cwd(), shot);
}

/**
 * Click the tile inside the open "Select profile" dialog whose primary
 * text line equals `pageName`. Uses Playwright's filter+hasText, which
 * is much more reliable than role+name lookups for FB's nested markup.
 */
async function clickTileByName(page: Page, pageName: string): Promise<boolean> {
  const dialog = page.locator('[role="dialog"]').first();
  // Each tile is a [role="button"] inside the dialog.
  const tile = dialog
    .locator('[role="button"]')
    .filter({ hasText: pageName })
    .first();
  try {
    await tile.waitFor({ state: "visible", timeout: 4000 });
    await tile.click();
    return true;
  } catch {
    // No tile in dialog scope — try without dialog scope (some builds use a
    // popover positioned outside any [role="dialog"]).
    const fallback = page.locator('[role="button"]').filter({ hasText: pageName }).first();
    try {
      await fallback.waitFor({ state: "visible", timeout: 2000 });
      await fallback.click();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Switch the active identity to a Page by name.
 *   1. goto facebook.com
 *   2. click avatar
 *   3. click "See all profiles" / "See all Pages" (always — that gives the
 *      proper dialog where tile clicks actually switch identity)
 *   4. click the tile in the dialog
 *   5. wait for navigation to settle
 */
export async function switchToPage(page: Page, pageName: string): Promise<boolean> {
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
  await randomDelay(800, 1500);

  const trigger = await accountSwitcherTrigger(page);
  if (!trigger) {
    const shot = await dumpDebug(page, `switch-no-trigger-${pageName}`);
    appendLog({ level: "error", source: pageName, message: `Avatar trigger not found — ${shot}` });
    return false;
  }
  await trigger.click();
  await randomDelay(600, 1100);

  // Always open the dialog. The inline popup tiles often don't actually
  // switch identity when clicked; the dialog version reliably does.
  const seeAll = await seeAllProfiles(page);
  if (seeAll) {
    await seeAll.click().catch(() => {});
    await randomDelay(900, 1700);
  }

  const ok = await clickTileByName(page, pageName);
  if (!ok) {
    const shot = await dumpDebug(page, `switch-tile-not-found-${pageName.replace(/\s+/g, "_")}`);
    appendLog({
      level: "error",
      source: pageName,
      message: `Tile "${pageName}" not found in dialog — ${shot}`,
    });
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }

  // Switching triggers a full navigation. Wait for it.
  await randomDelay(2500, 4000);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  return true;
}
