import { chromium } from "playwright";
import { ensureAuthDir, getStorageStatePath } from "@/lib/automation/browser";
import { appendLog } from "@/lib/logs";
import { DEFAULT_ACCOUNT_ID, getAccount } from "@/lib/accounts";

export const runtime = "nodejs";

/**
 * Opens a headed browser so the user can sign into Facebook for the
 * given account slot. ?account=<id> selects which slot to capture into;
 * defaults to "default". Honors the slot's configured proxy.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;

  await ensureAuthDir(accountId);
  const acc = await getAccount(accountId);
  if (acc?.proxy) {
    appendLog(
      { level: "info", message: `Login through proxy: ${acc.proxy.server}` },
      accountId,
    );
  }

  const browser = await chromium.launch({
    headless: false,
    proxy: acc?.proxy ? { ...acc.proxy } : undefined,
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  await page.goto("https://www.facebook.com/login");

  appendLog(
    { level: "info", message: "Login window opened — please sign in" },
    accountId,
  );

  const deadline = Date.now() + 5 * 60 * 1000;
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
    await context.storageState({ path: getStorageStatePath(accountId) });
    appendLog({ level: "info", message: "Session captured and saved" }, accountId);
  } else {
    appendLog({ level: "warn", message: "Login timed out — no session saved" }, accountId);
  }

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  return Response.json({ ok: captured });
}
