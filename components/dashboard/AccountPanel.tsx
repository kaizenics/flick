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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Globe, LogIn, MoreHorizontal, Play, Square, Trash2, X } from "lucide-react";

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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`/api/automation/status${qs}`, { cache: "no-store" });
        if (cancelled) return;
        const next = (await r.json()) as Status;
        setStatus(next);
        const delay = next.running ? 2000 : 15000;
        timer = setTimeout(tick, delay);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 15000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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

  const running = !!status?.running;
  const targets = config?.targetUrls ?? [];
  const statusLine = !status
    ? "Checking status…"
    : running
      ? `Running${status.startedAt ? ` since ${new Date(status.startedAt).toLocaleTimeString()}` : ""}${targets.length ? ` on ${targets.length} target ${targets.length === 1 ? "Page" : "Pages"}` : ""}.`
      : !status.hasSession
        ? "No saved Facebook session. Log in to capture one."
        : targets.length === 0
          ? "Session saved. Add a target Page before starting."
          : `Idle. Session saved, ${targets.length} target ${targets.length === 1 ? "Page" : "Pages"} ready.`;

  return (
    <div className="flex min-w-0 flex-col rounded-[20px] bg-card">
      {/* Header: name, status line, the one main action. */}
      <header className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <input
              aria-label="Account name"
              className="min-w-0 flex-1 rounded-md bg-transparent text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={account.name}
              onChange={(e) => onRename(account.id, e.target.value)}
            />
            {!status ? null : running ? (
              <Badge variant="positive">Running</Badge>
            ) : status.hasSession ? (
              <Badge variant="neutral">Idle</Badge>
            ) : (
              <Badge variant="warning">Needs login</Badge>
            )}
          </div>
          <p
            className={cn(
              "text-sm",
              status && !running && (!status.hasSession || targets.length === 0)
                ? "text-warning"
                : "text-muted-foreground",
            )}
          >
            {statusLine}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => post("/api/automation/stop")}
            >
              <Square data-icon="inline-start" /> Stop
            </Button>
          ) : status && !status.hasSession ? (
            <Button disabled={busy} onClick={() => post("/api/login")}>
              <LogIn data-icon="inline-start" /> Log in to Facebook
            </Button>
          ) : (
            <Button
              disabled={busy || running || !status?.hasSession}
              onClick={() =>
                post("/api/automation/start", {
                  headless: !headed,
                  speed: fast ? "fast" : "normal",
                })
              }
            >
              <Play data-icon="inline-start" /> Start
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Account options" />}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem disabled={busy} onClick={() => post("/api/login")}>
                <LogIn /> {status?.hasSession ? "Log in again" : "Log in to Facebook"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setProxyOpen(true)}>
                <Globe /> {account.proxy?.server ? "Edit proxy" : "Set proxy"}
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 /> Delete account
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Run options */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border px-5 py-3.5 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={fast} onCheckedChange={setFast} disabled={running} />
          Fast
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={headed} onCheckedChange={setHeaded} disabled={running} />
          Show browser
        </label>
        <span className="ml-auto truncate text-xs text-faint">
          {account.proxy?.server ? `Proxy ${account.proxy.server}` : "No proxy"}
        </span>
      </div>

      {/* Targets and sources */}
      <div className="grid border-t border-border md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3 p-5 md:border-r md:border-border">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">
              Target Pages <span className="num font-normal text-muted-foreground">{targets.length}</span>
            </h3>
            <p className="text-xs text-faint">Each owned Page follows and likes every target here.</p>
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="New target Page URL"
              placeholder="https://www.facebook.com/..."
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTarget()}
            />
            <Button variant="outline" onClick={addTarget} disabled={!newTarget.trim()}>
              Add
            </Button>
          </div>
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No targets yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {targets.map((u, i) => (
                <li key={i} className="flex items-center gap-1">
                  <Input
                    aria-label={`Target Page ${i + 1}`}
                    className="h-8 text-xs"
                    value={u}
                    onChange={(e) => updateTargetAt(i, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeTarget(i)}
                    aria-label={`Remove target ${i + 1}`}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3 border-t border-border p-5 md:border-t-0">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">
              Source Pages{" "}
              <span className="num font-normal text-muted-foreground">{config?.sources.length ?? 0}</span>
            </h3>
            <p className="text-xs text-faint">Optional. Leave empty to use every Page this account owns.</p>
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="New source Page name"
              placeholder="Exact Page name"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSource()}
            />
            <Button variant="outline" onClick={addSource} disabled={!newSource.trim()}>
              Add
            </Button>
          </div>
          {config?.sources.length ? (
            <ul className="flex flex-col">
              {config.sources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                  <span className="truncate">{s.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeSource(s.id)}
                    aria-label={`Remove source ${s.name}`}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Auto-discovering owned Pages.</p>
          )}
        </section>
      </div>

      {/* Logs */}
      <section className="flex flex-col gap-3 border-t border-border p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">
            Logs <span className="num font-normal text-muted-foreground">{logs.length}</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => post("/api/logs/clear")}
            disabled={logs.length === 0}
          >
            Clear
          </Button>
        </div>
        <div
          ref={logBoxRef}
          className={cn(
            "overflow-y-auto rounded-xl bg-black p-3 font-mono text-xs leading-relaxed",
            logs.length > 0 && "h-64",
          )}
        >
          {logs.length === 0 ? (
            <p className="text-faint">No log lines yet.</p>
          ) : (
            logs.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "break-words",
                  l.level === "error"
                    ? "text-danger-ink"
                    : l.level === "warn"
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                <span className="text-faint">{new Date(l.ts).toLocaleTimeString()} </span>
                {l.status && <span className="text-faint">[{l.status}] </span>}
                {l.source && <span className="text-white">{l.source} </span>}
                {l.target && <span className="text-white">→ {l.target} </span>}
                <span>{l.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <Dialog open={proxyOpen} onOpenChange={setProxyOpen}>
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
                variant="destructive"
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
  );
}
