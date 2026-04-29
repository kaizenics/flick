import type { Page } from "playwright";
import {
  accountSwitcherTrigger,
  seeAllProfiles,
  profileTileByName,
} from "./selectors";
import { randomDelay } from "./browser";

/**
 * Switch the active identity from the personal profile to a Page identity
 * by name. Returns true if the switch UI confirmed the change.
 *
 * Facebook only exposes this when the personal account owns at least one
 * Page and "Use Facebook as Page" is supported in the current UI.
 */
export async function switchToPage(page: Page, pageName: string): Promise<boolean> {
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
  await randomDelay();

  const trigger = await accountSwitcherTrigger(page);
  if (!trigger) return false;
  await trigger.click();
  await randomDelay(400, 1200);

  // Some UIs show profiles inline; others require "See all profiles".
  const seeAll = await seeAllProfiles(page);
  if (seeAll) {
    await seeAll.click();
    await randomDelay(600, 1400);
  }

  const tile = await profileTileByName(page, pageName);
  if (!tile) return false;
  await tile.click();

  // Wait for navigation to settle. FB usually redirects to the page feed.
  try {
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  } catch {
    // networkidle is a heuristic on FB — fall through.
  }

  await randomDelay();
  return true;
}
