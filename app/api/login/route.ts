import { chromium } from "playwright";
import { ensureAuthDir, STORAGE_STATE_PATH } from "@/lib/automation/browser";
import { appendLog } from "@/lib/logs";

export const runtime = "nodejs";

/**
 * Opens a headed browser so the user can log into Facebook manually.
 * On a successful login (detected by reaching facebook.com/ with a c_user
 * cookie), we save the storage state for reuse by automation runs.
 *
 * This is a long-running endpoint — it will resolve only once login is
 * captured or after a timeout. Trigger it from the dashboard's "Login" button.
 */
export async function POST() {
  await ensureAuthDir();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  await page.goto("https://www.facebook.com/login");

  appendLog({ level: "info", message: "Login window opened — please sign in" });

  const deadline = Date.now() + 5 * 60 * 1000; // 5 min
  let captured = false;

  while (Date.now() < deadline) {
    const cookies = await context.cookies("https://www.facebook.com");
    if (cookies.some((c) => c.name === "c_user")) {
      captured = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (captured) {
    await context.storageState({ path: STORAGE_STATE_PATH });
    appendLog({ level: "info", message: "Session captured and saved" });
  } else {
    appendLog({ level: "warn", message: "Login timed out — no session saved" });
  }

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  return Response.json({ ok: captured });
}
