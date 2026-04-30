import {
  launchBrowser,
  hasStorageState,
  randomDelay,
  setDelayScale,
  accountContext,
} from "./browser";
import { switchToPage } from "./pageSwitch";
import { followPage } from "./follow";
import { discoverOwnedPages } from "./discover";
import { readConfig } from "../store";
import { appendLog } from "../logs";
import { DEFAULT_ACCOUNT_ID, getAccount } from "../accounts";

type RunnerState = {
  running: boolean;
  startedAt: string | null;
  abort: AbortController | null;
};

const states = new Map<string, RunnerState>();

function getState(id: string): RunnerState {
  let s = states.get(id);
  if (!s) {
    s = { running: false, startedAt: null, abort: null };
    states.set(id, s);
  }
  return s;
}

export function getStatus(accountId: string = DEFAULT_ACCOUNT_ID) {
  const s = getState(accountId);
  return { running: s.running, startedAt: s.startedAt };
}

export type Speed = "normal" | "fast";

export async function startRun(
  opts: { headless?: boolean; speed?: Speed; accountId?: string } = {},
) {
  const accountId = opts.accountId ?? DEFAULT_ACCOUNT_ID;
  const state = getState(accountId);

  if (state.running) return { ok: false, reason: "already-running" as const };
  if (!(await hasStorageState(accountId))) return { ok: false, reason: "no-session" as const };

  const cfg = await readConfig(accountId);
  if (!cfg.targetUrl) return { ok: false, reason: "no-target" as const };

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.abort = new AbortController();
  const signal = state.abort.signal;

  // setDelayScale is global. With multiple accounts running concurrently
  // the last setter wins; that's acceptable since both want the same scale
  // when started together. Each new run resets it to its own preference.
  setDelayScale(opts.speed === "fast" ? 0.15 : 1);

  appendLog(
    {
      level: "info",
      status: "started",
      target: cfg.targetUrl,
      message:
        cfg.sources.length > 0
          ? `Run started — target="${cfg.targetUrl}", sources=${cfg.sources.length}`
          : `Run started — target="${cfg.targetUrl}", auto-discovering sources`,
    },
    accountId,
  );

  const acc = await getAccount(accountId);
  if (acc?.proxy) {
    appendLog(
      { level: "info", message: `Using proxy: ${acc.proxy.server}` },
      accountId,
    );
  }

  void accountContext.run(accountId, async () => {
    const { browser, context } = await launchBrowser({
      headless: opts.headless ?? true,
      withSession: true,
      blockMedia: opts.speed === "fast",
      accountId,
      proxy: acc?.proxy,
    });
    const page = await context.newPage();

    try {
      let sources = cfg.sources;
      if (sources.length === 0) {
        const discovered = await discoverOwnedPages(page);
        appendLog(
          {
            level: discovered.length ? "info" : "error",
            message: discovered.length
              ? `Detected ${discovered.length} Page(s) in this account: ${discovered.join(", ")}`
              : "No Pages detected — open data/accounts/<id>/debug to inspect what FB rendered",
          },
          accountId,
        );
        if (discovered.length === 0) return;
        sources = discovered.map((name) => ({ id: name, name }));
      } else {
        appendLog(
          {
            level: "info",
            message: `Using ${sources.length} manually-listed Page(s): ${sources.map((s) => s.name).join(", ")}`,
          },
          accountId,
        );
      }

      const total = sources.length;
      for (let i = 0; i < total; i++) {
        if (signal.aborted) break;
        const source = sources[i];
        const progress = `[${i + 1}/${total}]`;

        appendLog(
          { level: "info", source: source.name, message: `${progress} Switching to "${source.name}"` },
          accountId,
        );

        const switched = await switchToPage(page, source.name);
        if (!switched) {
          appendLog(
            {
              level: "error",
              status: "error",
              source: source.name,
              target: cfg.targetUrl,
              message: `${progress} Could not switch — skipping`,
            },
            accountId,
          );
          await randomDelay(2000, 4000);
          continue;
        }

        appendLog(
          {
            level: "info",
            source: source.name,
            target: cfg.targetUrl,
            message: `${progress} Switched. Navigating to target and following…`,
          },
          accountId,
        );

        try {
          const result = await followPage(page, cfg.targetUrl);
          const success = result.status === "followed" || result.status === "liked";
          appendLog(
            {
              level: success ? "info" : "warn",
              status: result.status,
              source: source.name,
              target: cfg.targetUrl,
              message:
                result.status === "not-supported"
                  ? `${progress} Skipped: ${result.reason}`
                  : `${progress} ${result.status}`,
            },
            accountId,
          );
        } catch (err) {
          appendLog(
            {
              level: "error",
              status: "error",
              source: source.name,
              target: cfg.targetUrl,
              message: `${progress} ${err instanceof Error ? err.message : String(err)}`,
            },
            accountId,
          );
        }

        await randomDelay(
          opts.speed === "fast" ? 300 : 3000,
          opts.speed === "fast" ? 900 : 8000,
        );
      }
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      state.running = false;
      state.startedAt = null;
      state.abort = null;
      appendLog({ level: "info", status: "stopped", message: "Run finished" }, accountId);
    }
  });

  return { ok: true as const };
}

export function stopRun(accountId: string = DEFAULT_ACCOUNT_ID) {
  const state = getState(accountId);
  if (!state.running || !state.abort) {
    return { ok: false, reason: "not-running" as const };
  }
  state.abort.abort();
  appendLog({ level: "info", status: "stopped", message: "Stop requested" }, accountId);
  return { ok: true as const };
}
