"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
type Config = { targetUrl: string; targetUrls: string[]; sources: SourcePage[] };

export type ProxyConfig = {
  server: string;
  username?: string;
  password?: string;
  bypass?: string;
};

export type Account = { id: string; name: string; proxy?: ProxyConfig };

export default function AccountPanel({
  account,
  onRename,
  onDelete,
}: {
  account: Account;
  onRename: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
}) {
  const qs = `?account=${encodeURIComponent(account.id)}`;

  const [status, setStatus] = useState<Status | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [headed, setHeaded] = useState(false);
  const [fast, setFast] = useState(true);
  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const r = await fetch(`/api/automation/status${qs}`, { cache: "no-store" });
      if (!cancelled) setStatus(await r.json());
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [qs]);

  useEffect(() => {
    fetch(`/api/targets${qs}`)
      .then((r) => r.json())
      .then(setConfig);
  }, [qs]);

  useEffect(() => {
    const es = new EventSource(`/api/logs${qs}`);
    es.addEventListener("snapshot", (e) => {
      setLogs(JSON.parse((e as MessageEvent).data) as LogEntry[]);
    });
    es.addEventListener("log", (e) => {
      const entry = JSON.parse((e as MessageEvent).data) as LogEntry;
      if (entry.message === "__cleared__") {
        setLogs([]);
        return;
      }
      setLogs((prev) => [...prev.slice(-499), entry]);
    });
    return () => es.close();
  }, [qs]);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  const post = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(`${path}${qs}`, {
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
    await fetch(`/api/targets${qs}`, {
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

  const addTarget = () => {
    if (!config) return;
    const url = newTarget.trim();
    if (!url) return;
    const next = [...(config.targetUrls ?? []), url];
    saveConfig({ ...config, targetUrls: next, targetUrl: next[0] });
    setNewTarget("");
  };
  const removeTarget = (i: number) => {
    if (!config) return;
    const next = (config.targetUrls ?? []).filter((_, idx) => idx !== i);
    saveConfig({ ...config, targetUrls: next, targetUrl: next[0] ?? "" });
  };
  const updateTargetAt = (i: number, v: string) => {
    if (!config) return;
    const next = [...(config.targetUrls ?? [])];
    next[i] = v;
    saveConfig({ ...config, targetUrls: next, targetUrl: next[0] ?? "" });
  };

  // Proxy editor state
  const [proxyOpen, setProxyOpen] = useState(false);
  const [proxyServer, setProxyServer] = useState(account.proxy?.server ?? "");
  const [proxyUser, setProxyUser] = useState(account.proxy?.username ?? "");
  const [proxyPass, setProxyPass] = useState(account.proxy?.password ?? "");
  const [proxyBypass, setProxyBypass] = useState(account.proxy?.bypass ?? "");

  useEffect(() => {
    setProxyServer(account.proxy?.server ?? "");
    setProxyUser(account.proxy?.username ?? "");
    setProxyPass(account.proxy?.password ?? "");
    setProxyBypass(account.proxy?.bypass ?? "");
  }, [account.proxy?.server, account.proxy?.username, account.proxy?.password, account.proxy?.bypass]);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveProxy = async (clear: boolean) => {
    const proxy = clear
      ? null
      : {
          server: proxyServer.trim(),
          username: proxyUser.trim() || undefined,
          password: proxyPass.trim() || undefined,
          bypass: proxyBypass.trim() || undefined,
        };
    if (!clear && !proxy?.server) {
      alert("Proxy server is required (or click Remove to clear).");
      return;
    }
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, proxy }),
    });
    setProxyOpen(false);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4 flex items-center justify-between gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight outline-none focus:underline"
          value={account.name}
          onChange={(e) => onRename(account.id, e.target.value)}
        />
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              status?.running ? "bg-green-500" : "bg-zinc-400"
            }`}
          />
          {status?.running ? "Running" : "Idle"}
          <Dialog open={proxyOpen} onOpenChange={setProxyOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              {account.proxy?.server ? "Proxy ✓" : "Proxy"}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Proxy for &quot;{account.name}&quot;</DialogTitle>
                <DialogDescription>
                  All Playwright traffic for this account (login + automation runs)
                  will route through this proxy. Leave server blank and click
                  Remove to clear.
                </DialogDescription>
              </DialogHeader>
              <div className="my-4 grid gap-3">
                <div className="grid gap-1">
                  <Label htmlFor={`proxy-server-${account.id}`}>Server</Label>
                  <Input
                    id={`proxy-server-${account.id}`}
                    placeholder="http://1.2.3.4:8080  or  socks5://host:1080"
                    value={proxyServer}
                    onChange={(e) => setProxyServer(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor={`proxy-user-${account.id}`}>Username</Label>
                    <Input
                      id={`proxy-user-${account.id}`}
                      placeholder="(optional)"
                      value={proxyUser}
                      onChange={(e) => setProxyUser(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`proxy-pass-${account.id}`}>Password</Label>
                    <Input
                      id={`proxy-pass-${account.id}`}
                      type="password"
                      placeholder="(optional)"
                      value={proxyPass}
                      onChange={(e) => setProxyPass(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`proxy-bypass-${account.id}`}>Bypass</Label>
                  <Input
                    id={`proxy-bypass-${account.id}`}
                    placeholder="(optional) e.g. *.internal,localhost"
                    value={proxyBypass}
                    onChange={(e) => setProxyBypass(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => saveProxy(true)}>
                  Remove
                </Button>
                <Button onClick={() => saveProxy(false)}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {onDelete && (
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <button
                onClick={() => setDeleteOpen(true)}
                className="ml-2 text-xs text-red-600 hover:underline"
              >
                delete
              </button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{account.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the saved Facebook session, target, sources, and
                    logs for this account. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={() => {
                      setDeleteOpen(false);
                      onDelete(account.id);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <section className="mb-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Session
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {status?.hasSession
              ? "Saved Facebook session detected."
              : "No saved session — click Login to capture one."}
          </span>
          <button
            disabled={busy}
            onClick={() => post("/api/login")}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Login to Facebook
          </button>
        </div>
      </section>

      <section className="mb-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Target Pages
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Each owned Page will follow / like every target listed here.
        </p>
        <div className="mb-2 flex gap-2">
          <input
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="https://www.facebook.com/..."
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTarget()}
          />
          <button
            onClick={addTarget}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(config?.targetUrls ?? []).map((u, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <input
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                value={u}
                onChange={(e) => updateTargetAt(i, e.target.value)}
              />
              <button
                onClick={() => removeTarget(i)}
                className="text-xs text-red-600 hover:underline"
              >
                remove
              </button>
            </li>
          ))}
          {(config?.targetUrls ?? []).length === 0 && (
            <li className="py-1.5 text-xs text-zinc-500">No targets yet.</li>
          )}
        </ul>
      </section>

      <section className="mb-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Source Pages (optional)
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Leave empty to auto-discover all owned Pages from this account.
        </p>
        <div className="mb-2 flex gap-2">
          <input
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Exact Page name"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSource()}
          />
          <button
            onClick={addSource}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {config?.sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
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
            <li className="py-1.5 text-xs text-zinc-500">No source Pages — will auto-discover.</li>
          )}
        </ul>
      </section>

      <section className="mb-3 flex flex-wrap items-center gap-3">
        <button
          disabled={busy || status?.running || !status?.hasSession}
          onClick={() =>
            post("/api/automation/start", {
              headless: !headed,
              speed: fast ? "fast" : "normal",
            })
          }
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Start
        </button>
        <button
          disabled={busy || !status?.running}
          onClick={() => post("/api/automation/stop")}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Stop
        </button>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={headed}
            onChange={(e) => setHeaded(e.target.checked)}
          />
          Headed
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={fast}
            onChange={(e) => setFast(e.target.checked)}
          />
          Fast
        </label>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Logs
          </div>
          <button
            onClick={() => post("/api/logs/clear")}
            className="text-xs text-zinc-500 hover:text-red-500 hover:underline"
          >
            clear
          </button>
        </div>
        <div
          ref={logBoxRef}
          className="h-64 overflow-y-auto rounded-md bg-zinc-950 p-2 font-mono text-[11px] leading-tight text-zinc-100"
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
  );
}
