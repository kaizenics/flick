import { chromium, type Browser, type BrowserContext } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

export const STORAGE_STATE_PATH = path.join(
  process.cwd(),
  "data",
  "auth",
  "storageState.json",
);

export async function hasStorageState() {
  try {
    await fs.access(STORAGE_STATE_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function ensureAuthDir() {
  await fs.mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });
}

export type LaunchOptions = {
  headless?: boolean;
  withSession?: boolean;
};

export async function launchBrowser(
  opts: LaunchOptions = {},
): Promise<{ browser: Browser; context: BrowserContext }> {
  const { headless = true, withSession = true } = opts;
  await ensureAuthDir();

  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const useSession = withSession && (await hasStorageState());

  const context = await browser.newContext({
    storageState: useSession ? STORAGE_STATE_PATH : undefined,
    viewport: { width: 1366, height: 820 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
  });

  // Light fingerprint hardening — webdriver flag.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return { browser, context };
}

// Global multiplier applied to every randomDelay call. 1.0 = normal,
// 0.3 ≈ fast, 0 ≈ no delay (bot-obvious; use only for local debug).
let delayScale = 1;
export function setDelayScale(scale: number) {
  delayScale = Math.max(0, scale);
}

export function randomDelay(minMs = 800, maxMs = 2400) {
  const ms = Math.floor((minMs + Math.random() * (maxMs - minMs)) * delayScale);
  return new Promise<void>((r) => setTimeout(r, ms));
}
