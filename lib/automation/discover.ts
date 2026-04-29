import type { Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import { accountSwitcherTrigger, seeAllProfiles } from "./selectors";
import { randomDelay } from "./browser";
import { appendLog } from "../logs";

const NOISE_RE =
  /^(create( page| new)?|see all( profiles| pages)?|switch|manage|settings|log ?out|select profile|active|see more|home|menu|notifications?|messenger|search|edit|advertise|insights|professional dashboard|find friends|deactivated and deleted pages|back)$/i;

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
 * Open the "Select profile" dialog and scrape page names from each tile.
 * Each tile is a [role="button"] inside the dialog whose first text line
 * is the page name.
 */
export async function discoverOwnedPages(page: Page): Promise<string[]> {
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
  await randomDelay(800, 1500);

  const trigger = await accountSwitcherTrigger(page);
  if (!trigger) {
    const shot = await dumpDebug(page, "discover-no-trigger");
    appendLog({ level: "error", message: `Avatar trigger not found — ${shot}` });
    return [];
  }
  await trigger.click();
  await randomDelay(600, 1100);

  // Click "See all profiles" / "See all Pages" to open the dialog. If the
  // tiles are already inline, that's fine — we still scrape the same way.
  const seeAll = await seeAllProfiles(page);
  if (seeAll) {
    await seeAll.click().catch(() => {});
    await randomDelay(900, 1700);
  }

  // Scrape: any visible [role="button"] containing an image and text.
  const tileTexts = await page.evaluate(() => {
    const dialog =
      document.querySelector('[role="dialog"]') ??
      document.querySelector('[role="menu"]');
    const root = dialog ?? document.body;
    const buttons = Array.from(
      root.querySelectorAll<HTMLElement>('[role="button"], [role="link"], a[href]'),
    );
    const out: string[] = [];
    for (const el of buttons) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (!el.querySelector("img, svg image")) continue;
      // First non-empty leaf text = page name. Subsequent leaves are
      // metadata like "7 notifications".
      let name = "";
      const walk = (n: Element) => {
        for (const child of Array.from(n.children)) {
          if (name) return;
          const ct = (child as HTMLElement).children.length === 0
            ? (child.textContent || "").trim()
            : "";
          if (ct) {
            name = ct;
            return;
          }
          walk(child);
        }
      };
      walk(el);
      if (name) out.push(name);
    }
    return out;
  });

  const shot = await dumpDebug(page, "discover-dialog");
  appendLog({
    level: "info",
    message: `Dialog tiles (${tileTexts.length}): ${JSON.stringify(
      tileTexts.slice(0, 30),
    )} — ${shot}`,
  });

  await page.keyboard.press("Escape").catch(() => {});

  return [...new Set(tileTexts.map((s) => s.replace(/\s+/g, " ").trim()))]
    .filter((s) => s.length > 0 && s.length <= 80)
    .filter((s) => !NOISE_RE.test(s))
    .filter((s) => !/^\d+\s*notifications?$/i.test(s));
}
