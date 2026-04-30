import type { Page } from "playwright";
import { accountSwitcherTrigger, seeAllProfiles } from "./selectors";
import { randomDelay } from "./browser";
import { appendLog } from "../logs";

/**
 * Click the row in the open dialog whose name matches `pageName`.
 *
 * Two-pass DOM scan:
 *   - Pass 1: find any element whose ENTIRE textContent equals the name
 *     (handles names split across multiple inline spans).
 *   - Pass 2: find any visible element whose first innerText line equals
 *     the name (handles names with a sibling "1 notification" string).
 * In both passes, we click the element itself; if the click doesn't
 * register a switch (no nav), the caller will detect the URL didn't
 * change.
 */
/**
 * Mark the visible profile-switcher dialog so we can target it
 * unambiguously. FB sometimes leaves stale dialog DOM around, and
 * `[role="dialog"]:visible` alone can match a Messenger panel.
 *
 * We tag the largest visible dialog with a data attribute, then use
 * that attribute as the click scope.
 */
async function tagSwitcherDialog(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"]'),
    ).filter((d) => {
      const r = d.getBoundingClientRect();
      return r.width > 100 && r.height > 100;
    });
    if (dialogs.length === 0) return false;
    dialogs.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    document
      .querySelectorAll("[data-fbauto-switcher]")
      .forEach((el) => el.removeAttribute("data-fbauto-switcher"));
    dialogs[0].setAttribute("data-fbauto-switcher", "1");
    return true;
  });
}

async function clickTileByName(page: Page, pageName: string): Promise<boolean> {
  if (!(await tagSwitcherDialog(page))) return false;

  const dialog = page.locator('[data-fbauto-switcher="1"]');
  // Filter to a row inside the dialog whose first line of text equals the
  // page name AND that contains an avatar image — that's the tile.
  const tile = dialog
    .locator("div")
    .filter({
      has: page.locator("img, svg"),
      hasText: new RegExp(`^${pageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    })
    .first();

  try {
    await tile.waitFor({ state: "visible", timeout: 4000 });
    await tile.scrollIntoViewIfNeeded();
    // Playwright's locator click dispatches a real mouse gesture
    // (move + mousedown + mouseup) at the element center.
    await tile.click();
  } catch {
    return false;
  }

  // Confirm: a real switch closes the dialog. If it stays visible past
  // the timeout, the click hit something but didn't trigger the switch.
  try {
    await dialog.waitFor({ state: "hidden", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Switch the active identity to a Page by name.
 *   1. goto facebook.com
 *   2. click avatar → click "See all profiles" (opens "Your profiles & Pages")
 *   3. type the name into the dialog's search box
 *   4. click the matching tile
 *   5. wait for navigation
 */
export async function switchToPage(page: Page, pageName: string): Promise<boolean> {
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
  await randomDelay(800, 1500);

  const trigger = await accountSwitcherTrigger(page);
  if (!trigger) {
    appendLog({ level: "error", source: pageName, message: "Avatar trigger not found" });
    return false;
  }
  await trigger.click();
  await randomDelay(600, 1100);

  const seeAll = await seeAllProfiles(page);
  if (seeAll) {
    await seeAll.click().catch(() => {});
    await randomDelay(1000, 1800);
  }

  // Expand "See more profiles" so tiles below the fold join the DOM.
  // Short timeout — if it's not there immediately, it isn't there.
  for (let i = 0; i < 10; i++) {
    const more = page.getByText(/see more profiles/i).first();
    try {
      await more.waitFor({ state: "visible", timeout: 400 });
      await more.click();
      await randomDelay(300, 600);
    } catch {
      break;
    }
  }

  const ok = await clickTileByName(page, pageName);
  if (!ok) {
    appendLog({
      level: "error",
      source: pageName,
      message: `Click did not switch identity for "${pageName}" (dialog stayed open)`,
    });
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }

  await randomDelay(1500, 2500);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  return true;
}
