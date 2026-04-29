import { launchBrowser, hasStorageState, randomDelay, setDelayScale } from "./browser";
import { switchToPage } from "./pageSwitch";
import { followPage } from "./follow";
import { discoverOwnedPages } from "./discover";
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

export type Speed = "normal" | "fast";

export async function startRun(
  opts: { headless?: boolean; speed?: Speed } = {},
) {
  setDelayScale(opts.speed === "fast" ? 0.3 : 1);
  if (state.running) return { ok: false, reason: "already-running" as const };
  if (!(await hasStorageState())) return { ok: false, reason: "no-session" as const };

  const cfg = await readConfig();
  if (!cfg.targetUrl) return { ok: false, reason: "no-target" as const };

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.abort = new AbortController();
  const signal = state.abort.signal;

  appendLog({
    level: "info",
    status: "started",
    target: cfg.targetUrl,
    message:
      cfg.sources.length > 0
        ? `Run started — target="${cfg.targetUrl}", sources=${cfg.sources.length}`
        : `Run started — target="${cfg.targetUrl}", auto-discovering sources`,
  });

  void (async () => {
    const { browser, context } = await launchBrowser({
      headless: opts.headless ?? true,
      withSession: true,
    });
    const page = await context.newPage();

    try {
      let sources = cfg.sources;
      if (sources.length === 0) {
        const discovered = await discoverOwnedPages(page);
        appendLog({
          level: discovered.length ? "info" : "error",
          message: discovered.length
            ? `Detected ${discovered.length} Page(s) in this account: ${discovered.join(", ")}`
            : "No Pages detected — open data/debug/discover-switcher-*.html to inspect what FB rendered",
        });
        if (discovered.length === 0) return;
        sources = discovered.map((name) => ({ id: name, name }));
      } else {
        appendLog({
          level: "info",
          message: `Using ${sources.length} manually-listed Page(s): ${sources.map((s) => s.name).join(", ")}`,
        });
      }

      const total = sources.length;
      for (let i = 0; i < total; i++) {
        if (signal.aborted) break;
        const source = sources[i];
        const progress = `[${i + 1}/${total}]`;

        appendLog({
          level: "info",
          source: source.name,
          message: `${progress} Switching to "${source.name}"`,
        });

        const switched = await switchToPage(page, source.name);
        if (!switched) {
          appendLog({
            level: "error",
            status: "error",
            source: source.name,
            target: cfg.targetUrl,
            message: `${progress} Could not switch — skipping`,
          });
          await randomDelay(2000, 4000);
          continue;
        }

        appendLog({
          level: "info",
          source: source.name,
          target: cfg.targetUrl,
          message: `${progress} Switched. Navigating to target and following…`,
        });

        try {
          const result = await followPage(page, cfg.targetUrl);
          const success = result.status === "followed" || result.status === "liked";
          appendLog({
            level: success ? "info" : "warn",
            status: result.status,
            source: source.name,
            target: cfg.targetUrl,
            message:
              result.status === "not-supported"
                ? `${progress} Skipped: ${result.reason}`
                : `${progress} ${result.status}`,
          });
        } catch (err) {
          appendLog({
            level: "error",
            status: "error",
            source: source.name,
            target: cfg.targetUrl,
            message: `${progress} ${err instanceof Error ? err.message : String(err)}`,
          });
        }

        await randomDelay(opts.speed === "fast" ? 800 : 3000, opts.speed === "fast" ? 2000 : 8000);
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
