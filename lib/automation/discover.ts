import type { Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import { accountSwitcherTrigger, seeAllProfiles } from "./selectors";
import { randomDelay } from "./browser";
import { appendLog } from "../logs";

const NOISE_RE =
  /^(your profiles & pages|create( page| new)?|see all( profiles| pages)?|see more profiles|switch accounts|switch|manage|settings|log ?out|select profile|active|see more|home|menu|notifications?|messenger|search|search profiles and pages|edit|advertise|insights|professional dashboard|find friends|deactivated and deleted pages|back|go to accounts center)$/i;

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

async function scrapeTiles(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const dialog =
      document.querySelector('[role="dialog"]') ??
      document.querySelector('[role="menu"]') ??
      document.body;
    const imgs = Array.from(dialog.querySelectorAll<HTMLImageElement>("img, svg image"));
    const out: string[] = [];
    for (const img of imgs) {
      const rect = (img as Element).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Walk up until we find an ancestor that has a text leaf — that's the row.
      let cur: HTMLElement | null = (img as HTMLElement).parentElement;
      let depth = 0;
      while (cur && depth < 8) {
        let firstLeaf = "";
        const stack: Element[] = [cur];
        while (stack.length && !firstLeaf) {
          const n = stack.shift()!;
          if (n.children.length === 0) {
            const t = (n.textContent || "").trim();
            if (t && t.length <= 80) {
              firstLeaf = t;
              break;
            }
          } else {
            stack.push(...Array.from(n.children));
          }
        }
        if (firstLeaf) {
          out.push(firstLeaf);
          break;
        }
        cur = cur.parentElement;
        depth++;
      }
    }
    return out;
  });
}

async function expandAll(page: Page) {
  // Click "See more profiles" until it no longer appears, capped at 10 clicks.
  for (let i = 0; i < 10; i++) {
    const more = page
      .locator('[role="dialog"]')
      .getByText(/see more profiles/i)
      .first();
    try {
      await more.waitFor({ state: "visible", timeout: 1500 });
      await more.click();
      await randomDelay(700, 1300);
    } catch {
      return;
    }
  }
}

/**
 * Open avatar > "See all profiles" → "Your profiles & Pages" dialog.
 * Expand "See more profiles" until everything is loaded, then scrape
 * each visible row by walking from <img> up to its label leaf.
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

  const seeAll = await seeAllProfiles(page);
  if (seeAll) {
    await seeAll.click().catch(() => {});
    await randomDelay(1000, 1800);
  }

  await expandAll(page);
  await randomDelay(500, 900);

  const tiles = await scrapeTiles(page);

  const shot = await dumpDebug(page, "discover-dialog");
  appendLog({
    level: "info",
    message: `Dialog tiles raw (${tiles.length}): ${JSON.stringify(
      tiles.slice(0, 50),
    )} — ${shot}`,
  });

  await page.keyboard.press("Escape").catch(() => {});

  return [...new Set(tiles.map((s) => s.replace(/\s+/g, " ").trim()))]
    .filter((s) => s.length > 0 && s.length <= 80)
    .filter((s) => !NOISE_RE.test(s))
    .filter((s) => !/^\d+\s*notifications?$/i.test(s));
}
