/**
 * CLI fallback for capturing a Facebook session without going through
 * the dashboard. Run with:
 *
 *   pnpm tsx scripts/login.ts
 *
 * Opens a headed Chromium, waits up to 5 minutes for you to sign in,
 * then writes data/auth/storageState.json.
 */
import { chromium } from "playwright";
import { ensureAuthDir, STORAGE_STATE_PATH } from "../lib/automation/browser";

async function main() {
  await ensureAuthDir();
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  await page.goto("https://www.facebook.com/login");

  console.log("Sign in to Facebook in the opened window. Waiting up to 5 min...");
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const cookies = await context.cookies("https://www.facebook.com");
    if (cookies.some((c) => c.name === "c_user")) break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Saved session → ${STORAGE_STATE_PATH}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
