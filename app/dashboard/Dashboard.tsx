"use client";

import { useEffect, useRef, useState } from "react";

type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  source?: string;
  target?: string;
  status?: string;
  message: string;
};

type Status = { running: boolean; startedAt: string | null; hasSession: boolean };
type SourcePage = { id: string; name: string; note?: string };
type Config = { targetUrl: string; sources: SourcePage[] };

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [newSource, setNewSource] = useState("");
  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const r = await fetch("/api/automation/status", { cache: "no-store" });
      if (!cancelled) setStatus(await r.json());
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    fetch("/api/targets")
      .then((r) => r.json())
      .then(setConfig);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/logs");
    es.addEventListener("snapshot", (e) => {
      setLogs(JSON.parse((e as MessageEvent).data) as LogEntry[]);
    });
    es.addEventListener("log", (e) => {
      const entry = JSON.parse((e as MessageEvent).data) as LogEntry;
      setLogs((prev) => [...prev.slice(-499), entry]);
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  const post = async (url: string, body?: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { reason?: string };
        const reasonMap: Record<string, string> = {
          "already-running": "A run is already in progress.",
          "no-session": "No saved Facebook session — click Login first.",
          "no-target": "Set the Target Page URL first.",
          "no-sources": "Add at least one Source Page name.",
          "not-running": "Nothing is running.",
        };
        alert(reasonMap[data.reason ?? ""] ?? `Request failed (${res.status})`);
      }
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async (cfg: Config) => {
    setConfig(cfg);
    await fetch("/api/targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
  };

  const addSource = () => {
    if (!config || !newSource.trim()) return;
    const s: SourcePage = { id: crypto.randomUUID(), name: newSource.trim() };
    saveConfig({ ...config, sources: [...config.sources, s] });
    setNewSource("");
  };

  const removeSource = (id: string) => {
    if (!config) return;
    saveConfig({ ...config, sources: config.sources.filter((s) => s.id !== id) });
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-black dark:text-zinc-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">FB Page Automation</h1>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                status?.running ? "bg-green-500" : "bg-zinc-400"
              }`}
            />
            {status?.running ? "Running" : "Idle"}
            {status?.startedAt && (
              <span className="text-zinc-500">
                · since {new Date(status.startedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Session
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm">
              {status?.hasSession
                ? "Saved Facebook session detected."
                : "No saved session — click Login to capture one."}
            </span>
            <button
              disabled={busy}
              onClick={() => post("/api/login")}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Login to Facebook
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Target Page (the Page that will receive follows)
          </h2>
          <input
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="https://www.facebook.com/jiro.andrei.345/"
            value={config?.targetUrl ?? ""}
            onChange={(e) =>
              config && saveConfig({ ...config, targetUrl: e.target.value })
            }
          />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Source Pages (your owned Pages — each will follow the target)
          </h2>
          <div className="mb-3 flex gap-2">
            <input
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Exact Page name as shown in FB account switcher"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSource()}
            />
            <button
              onClick={addSource}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
          </div>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {config?.sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{s.name}</span>
                <button
                  onClick={() => removeSource(s.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  remove
                </button>
              </li>
            ))}
            {config?.sources.length === 0 && (
              <li className="py-2 text-sm text-zinc-500">No source Pages yet.</li>
            )}
          </ul>
        </section>

        <section className="flex gap-2">
          <button
            disabled={busy || status?.running || !status?.hasSession}
            onClick={() => post("/api/automation/start", { headless: true })}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Start
          </button>
          <button
            disabled={busy || !status?.running}
            onClick={() => post("/api/automation/stop")}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Stop
          </button>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Logs
          </h2>
          <div
            ref={logBoxRef}
            className="h-80 overflow-y-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
          >
            {logs.map((l, i) => (
              <div
                key={i}
                className={
                  l.level === "error"
                    ? "text-red-400"
                    : l.level === "warn"
                      ? "text-amber-300"
                      : "text-zinc-200"
                }
              >
                <span className="text-zinc-500">
                  {new Date(l.ts).toLocaleTimeString()}{" "}
                </span>
                {l.status && <span className="text-zinc-400">[{l.status}] </span>}
                {l.source && <span className="text-blue-300">{l.source} </span>}
                {l.target && <span className="text-emerald-300">→ {l.target} </span>}
                <span>{l.message}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
