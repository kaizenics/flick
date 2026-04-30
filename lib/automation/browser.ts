import { chromium, type Browser, type BrowserContext } from "playwright";
import fs from "node:fs/promises";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  DEFAULT_ACCOUNT_ID,
  storageStatePath,
  accountDir,
  type ProxyConfig,
} from "../accounts";

// Account context — set by the runner so logs/storage paths can be
// derived without threading the id through every function.
export const accountContext = new AsyncLocalStorage<string>();
export function currentAccountId(): string {
  return accountContext.getStore() ?? DEFAULT_ACCOUNT_ID;
}

export function getStorageStatePath(id?: string) {
  return storageStatePath(id ?? currentAccountId());
}

export async function hasStorageState(id?: string) {
  try {
    await fs.access(getStorageStatePath(id));
    return true;
  } catch {
    return false;
  }
}

export async function ensureAuthDir(id?: string) {
  await fs.mkdir(accountDir(id ?? currentAccountId()), { recursive: true });
}

export type LaunchOptions = {
  headless?: boolean;
  withSession?: boolean;
  blockMedia?: boolean;
  accountId?: string;
  proxy?: ProxyConfig;
};

export async function launchBrowser(
  opts: LaunchOptions = {},
): Promise<{ browser: Browser; context: BrowserContext }> {
  const {
    headless = true,
    withSession = true,
    blockMedia = false,
    accountId,
    proxy,
  } = opts;
  await ensureAuthDir(accountId);

  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
    proxy: proxy ? { ...proxy } : undefined,
  });

  const useSession = withSession && (await hasStorageState(accountId));

  const context = await browser.newContext({
    storageState: useSession ? getStorageStatePath(accountId) : undefined,
    viewport: { width: 1366, height: 820 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  if (blockMedia) {
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") {
        return route.abort();
      }
      return route.continue();
    });
  }

  return { browser, context };
}

let delayScale = 1;
export function setDelayScale(scale: number) {
  delayScale = Math.max(0, scale);
}

export function randomDelay(minMs = 800, maxMs = 2400) {
  const ms = Math.floor((minMs + Math.random() * (maxMs - minMs)) * delayScale);
  return new Promise<void>((r) => setTimeout(r, ms));
}
