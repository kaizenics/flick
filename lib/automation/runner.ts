import {
  launchBrowser,
  hasStorageState,
  randomDelay,
  setDelayScale,
  accountContext,
} from "./browser";
import { switchToPage } from "./pageSwitch";
import { followPage } from "./follow";
import { reactToPost } from "./reactions";
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
  const targets = (cfg.targetUrls?.length ? cfg.targetUrls : [cfg.targetUrl]).filter(
    (u) => u && u.length > 0,
  );
  const posts = (cfg.posts ?? []).filter((p) => p.url && p.url.length > 0);
  if (targets.length === 0 && posts.length === 0)
    return { ok: false, reason: "no-target" as const };

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.abort = new AbortController();
  const signal = state.abort.signal;

  // setDelayScale is global. With multiple accounts running concurrently
  // the last setter wins; that's acceptable since both want the same scale
  // when started together. Each new run resets it to its own preference.
  setDelayScale(opts.speed === "fast" ? 0.15 : 1);

  const targetSummary =
    targets.length === 1 ? `target="${targets[0]}"` : `targets=${targets.length}`;
  appendLog(
    {
      level: "info",
      status: "started",
      target: targets[0],
      message:
        cfg.sources.length > 0
          ? `Run started — ${targetSummary}, sources=${cfg.sources.length}`
          : `Run started — ${targetSummary}, auto-discovering sources`,
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
            message: `${progress} Switched. Visiting ${targets.length} target(s)…`,
          },
          accountId,
        );

        for (let t = 0; t < targets.length; t++) {
          if (signal.aborted) break;
          const target = targets[t];
          const tProgress =
            targets.length > 1 ? `${progress}(${t + 1}/${targets.length})` : progress;

          try {
            const result = await followPage(page, target);
            const success = result.status === "followed" || result.status === "liked";
            appendLog(
              {
                level: success ? "info" : "warn",
                status: result.status,
                source: source.name,
                target,
                message:
                  result.status === "not-supported"
                    ? `${tProgress} Skipped: ${result.reason}`
                    : `${tProgress} ${result.status}`,
              },
              accountId,
            );
          } catch (err) {
            appendLog(
              {
                level: "error",
                status: "error",
                source: source.name,
                target,
                message: `${tProgress} ${err instanceof Error ? err.message : String(err)}`,
              },
              accountId,
            );
          }

          // Brief pause between targets within the same source identity.
          if (t < targets.length - 1) {
            await randomDelay(
              opts.speed === "fast" ? 200 : 1500,
              opts.speed === "fast" ? 600 : 4000,
            );
          }
        }

        // Reactions phase: drop the chosen reaction on each post URL.
        for (let p = 0; p < posts.length; p++) {
          if (signal.aborted) break;
          const post = posts[p];
          const pProgress =
            posts.length > 1 ? `${progress}[reaction ${p + 1}/${posts.length}]` : `${progress}[reaction]`;

          try {
            const result = await reactToPost(page, post.url, post.reaction);
            appendLog(
              {
                level: result.status === "reacted" ? "info" : "warn",
                status: result.status,
                source: source.name,
                target: post.url,
                message:
                  result.status === "not-supported"
                    ? `${pProgress} ${post.reaction} skipped: ${result.reason}`
                    : `${pProgress} ${post.reaction} ${result.status}`,
              },
              accountId,
            );
          } catch (err) {
            appendLog(
              {
                level: "error",
                status: "error",
                source: source.name,
                target: post.url,
                message: `${pProgress} ${err instanceof Error ? err.message : String(err)}`,
              },
              accountId,
            );
          }

          if (p < posts.length - 1) {
            await randomDelay(
              opts.speed === "fast" ? 200 : 1500,
              opts.speed === "fast" ? 600 : 4000,
            );
          }
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
