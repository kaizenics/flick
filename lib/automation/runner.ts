import { launchBrowser, hasStorageState, randomDelay } from "./browser";
import { switchToPage } from "./pageSwitch";
import { followPage } from "./follow";
import { readConfig } from "../store";
import { appendLog } from "../logs";

type RunnerState = {
  running: boolean;
  startedAt: string | null;
  abort: AbortController | null;
};

const state: RunnerState = {
  running: false,
  startedAt: null,
  abort: null,
};

export function getStatus() {
  return { running: state.running, startedAt: state.startedAt };
}

export async function startRun(opts: { headless?: boolean } = {}) {
  if (state.running) return { ok: false, reason: "already-running" as const };
  if (!(await hasStorageState())) return { ok: false, reason: "no-session" as const };

  const cfg = await readConfig();
  if (!cfg.targetUrl) return { ok: false, reason: "no-target" as const };
  if (cfg.sources.length === 0) return { ok: false, reason: "no-sources" as const };

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.abort = new AbortController();
  const signal = state.abort.signal;

  appendLog({
    level: "info",
    status: "started",
    target: cfg.targetUrl,
    message: `Run started — target="${cfg.targetUrl}", sources=${cfg.sources.length}`,
  });

  void (async () => {
    const { browser, context } = await launchBrowser({
      headless: opts.headless ?? true,
      withSession: true,
    });
    const page = await context.newPage();

    try {
      for (const source of cfg.sources) {
        if (signal.aborted) break;

        const switched = await switchToPage(page, source.name);
        if (!switched) {
          appendLog({
            level: "error",
            status: "error",
            source: source.name,
            target: cfg.targetUrl,
            message: "Could not switch to this Page identity (skipping)",
          });
          await randomDelay(2000, 4000);
          continue;
        }

        try {
          const result = await followPage(page, cfg.targetUrl);
          appendLog({
            level: result.status === "followed" ? "info" : "warn",
            status: result.status,
            source: source.name,
            target: cfg.targetUrl,
            message:
              result.status === "not-supported"
                ? `Skipped: ${result.reason}`
                : result.status,
          });
        } catch (err) {
          appendLog({
            level: "error",
            status: "error",
            source: source.name,
            target: cfg.targetUrl,
            message: err instanceof Error ? err.message : String(err),
          });
        }

        await randomDelay(3000, 8000);
      }
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      state.running = false;
      state.startedAt = null;
      state.abort = null;
      appendLog({ level: "info", status: "stopped", message: "Run finished" });
    }
  })();

  return { ok: true as const };
}

export function stopRun() {
  if (!state.running || !state.abort) {
    return { ok: false, reason: "not-running" as const };
  }
  state.abort.abort();
  appendLog({ level: "info", status: "stopped", message: "Stop requested" });
  return { ok: true as const };
}
