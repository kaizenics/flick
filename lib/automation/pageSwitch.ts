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

async function waitForSwitchConfirmed(page: Page, timeout: number): Promise<boolean> {
  // A successful switch can manifest as: original dialog closes, OR a
  // confirmation dialog appears asking "Switch to X?" — in which case we
  // need to click its "Switch" / "Continue" button.
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const dialogStillOpen = await page
      .locator('[data-fbauto-switcher="1"]')
      .isVisible()
      .catch(() => false);
    if (!dialogStillOpen) return true;

    // Look for a confirm button on a sibling dialog.
    const confirm = page
      .getByRole("button", { name: /^(switch|continue|confirm)$/i })
      .first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click().catch(() => {});
      await randomDelay(500, 1000);
      continue;
    }

    await page.waitForTimeout(250);
  }
  return false;
}

async function clickTileByName(page: Page, pageName: string): Promise<boolean> {
  if (!(await tagSwitcherDialog(page))) return false;

  const dialog = page.locator('[data-fbauto-switcher="1"]');
  const safeName = pageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRegex = new RegExp(`^${safeName}$`, "i");
  const startsRegex = new RegExp(`^${safeName}\\b`, "i");

  // Prioritized list of accessible-name based locators.
  const candidates: Array<{ name: string; loc: ReturnType<typeof page.locator> }> = [
    {
      name: 'role=button name="Page Name"',
      loc: dialog.getByRole("button", { name: nameRegex }).first(),
    },
    {
      name: 'role=link name="Page Name"',
      loc: dialog.getByRole("link", { name: nameRegex }).first(),
    },
    {
      name: 'div[role=button] hasText',
      loc: dialog.locator('div[role="button"]').filter({ hasText: startsRegex }).first(),
    },
    {
      name: 'a[role=link] hasText',
      loc: dialog.locator('a[role="link"]').filter({ hasText: startsRegex }).first(),
    },
    {
      name: 'div[tabindex] hasText',
      loc: dialog.locator("div[tabindex]").filter({ hasText: startsRegex }).first(),
    },
  ];

  // Try each candidate; the first one that closes the dialog wins.
  for (const { name, loc } of candidates) {
    try {
      if (!(await loc.isVisible({ timeout: 1500 }).catch(() => false))) continue;
      await loc.scrollIntoViewIfNeeded().catch(() => {});

      // Strategy A: regular click.
      await loc.click({ timeout: 2000 }).catch(() => {});
      if (await waitForSwitchConfirmed(page, 3500)) return true;

      // Strategy B: focus + keyboard Enter. React handlers wired to
      // onKeyDown often fire even when click hit-testing misses.
      await loc.focus().catch(() => {});
      await page.keyboard.press("Enter").catch(() => {});
      if (await waitForSwitchConfirmed(page, 3500)) return true;

      // Strategy C: raw mouse click at the tile's bounding-box center.
      // Bypasses any overlay element that's intercepting pointer events.
      try {
        const box = await loc.boundingBox();
        if (box) {
          await page.mouse.click(
            box.x + box.width / 2,
            box.y + box.height / 2,
          );
          if (await waitForSwitchConfirmed(page, 3500)) return true;
        }
      } catch {
        // ignore
      }
    } catch {
      // Move on to next strategy.
    }
    void name;
  }

  return false;
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
