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
async function clickTileByName(page: Page, pageName: string): Promise<boolean> {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    // Locate the row's bounding box in-page — search the WHOLE document,
    // pick a row-shaped element whose first innerText line matches the
    // name. We don't trust [role="dialog"] scoping because FB renders
    // multiple dialog containers.
    const box = await page.evaluate((name) => {
      const lower = name.toLowerCase();

      // Pick the *visible* dialog. FB sometimes leaves stale dialog DOM
      // around — querySelector('[role="dialog"]') can return the wrong one.
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      ).filter((d) => {
        const r = d.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      });
      if (dialogs.length === 0) return null;
      // Prefer the largest visible dialog — that's the profile switcher.
      dialogs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height,
      );
      const dialog = dialogs[0];

      const all = Array.from(dialog.querySelectorAll<HTMLElement>("*"));

      const looksLikeRow = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.height >= 36 && r.height <= 110 && r.width >= 200;
      };

      const candidates: { el: HTMLElement; r: DOMRect }[] = [];

      for (const el of all) {
        if (!looksLikeRow(el)) continue;
        // Must contain an avatar image — that's what distinguishes a
        // profile tile from a generic text row.
        if (!el.querySelector("img, svg image")) continue;
        const inner = (el.innerText || "").trim();
        if (!inner) continue;
        const first = inner.split("\n")[0].replace(/\s+/g, " ").trim();
        if (first.toLowerCase() !== lower) continue;
        candidates.push({ el, r: el.getBoundingClientRect() });
      }

      if (candidates.length === 0) return null;

      // Smallest matching row = innermost actual tile (not a wrapper).
      candidates.sort((a, b) => a.r.height * a.r.width - b.r.height * b.r.width);
      const best = candidates[0];
      best.el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      const r = best.el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, pageName);

    if (box) {
      // Real mouse gesture — bubbles through React's event system.
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.waitForTimeout(50);
      await page.mouse.up();
      return true;
    }

    await page.waitForTimeout(250);
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
    const shot = await dumpDebug(page, `switch-no-trigger-${pageName}`);
    appendLog({ level: "error", source: pageName, message: `Avatar trigger not found — ${shot}` });
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

  const urlBefore = page.url();
  const ok = await clickTileByName(page, pageName);
  if (!ok) {
    const shot = await dumpDebug(page, `switch-tile-not-found-${pageName.replace(/\s+/g, "_")}`);
    appendLog({
      level: "error",
      source: pageName,
      message: `Could not click tile "${pageName}" in dialog — ${shot}`,
    });
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }

  // A real identity switch triggers a navigation. Wait up to 8s for the URL
  // to change off facebook.com/. If it doesn't, the click hit something but
  // didn't actually switch — log and report failure.
  try {
    await page.waitForURL((url) => url.href !== urlBefore, { timeout: 5000 });
  } catch {
    const shot = await dumpDebug(page, `switch-no-nav-${pageName.replace(/\s+/g, "_")}`);
    appendLog({
      level: "error",
      source: pageName,
      message: `Click registered but URL didn't change — switch likely failed (${shot})`,
    });
    return false;
  }

  await randomDelay(1000, 2000);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  return true;
}
