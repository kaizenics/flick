"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  KeyRound,
  Target as TargetIcon,
  Heart,
  Play,
  Square,
  Eye,
  EyeOff,
  Zap,
  ZapOff,
  Share2,
  type LucideIcon,
} from "lucide-react";

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function ThreadsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.18 22h-.04C7.86 21.97 4.6 19.07 3.5 14.79c-.92-3.6-.06-7.27 2.36-10.06C7.74 2.6 10.27 1.49 12.83 1.5h.05c2.55.03 4.5.84 5.95 2.45 1.18 1.31 1.86 3.05 2.07 5.32l-1.99.18c-.16-1.79-.66-3.13-1.55-4.13-1.06-1.18-2.55-1.79-4.5-1.82h-.04c-2 0-3.96.91-5.45 2.55-1.99 2.18-2.66 5.13-1.92 8.07.92 3.55 3.43 5.92 6.7 5.95h.04c1.93-.02 3.41-.51 4.45-1.5.79-.74 1.16-1.7 1.16-2.82 0-1.96-1.62-2.82-3.4-3.04-.16 1.46-.83 2.7-1.85 3.36-.7.45-1.55.62-2.45.5-1.27-.18-2.4-.96-2.96-2.05-.66-1.27-.55-2.7.27-3.78.84-1.1 2.16-1.62 3.7-1.45.9.1 1.84.36 2.83.78-.13-1.13-.5-1.95-1.05-2.41-.65-.55-1.65-.7-2.75-.36-1.04.32-1.95 1.04-2.27 1.95l-1.86-.65c.5-1.43 1.84-2.51 3.55-3.05 1.62-.5 3.13-.27 4.16.6.96.83 1.53 2.18 1.66 3.96 2.34.45 4.23 1.95 4.23 4.96 0 1.66-.6 3.13-1.78 4.25-1.43 1.36-3.41 2.04-5.85 2.06h-.04zm-.85-7.32c-.5 0-1 .15-1.34.6-.36.5-.4 1.16-.1 1.78.27.55.85.91 1.5 1 .56.07 1.07-.04 1.5-.32.66-.43 1.07-1.27 1.18-2.32-.85-.43-1.66-.7-2.5-.74h-.24z" />
    </svg>
  );
}
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  source?: string;
  target?: string;
  status?: string;
  message: string;
};

type Status = { running: boolean; startedAt: string | null; hasSession: boolean };
type SourcePage = { id: string; name: string };
type Config = { targetUrl: string; targetUrls: string[]; sources: SourcePage[] };

type RunState = {
  status: Status | null;
  config: Config | null;
  logs: LogEntry[];
  current?: { i: number; n: number; source?: string };
  active: NodeKey | null;
  lastResult?: string;
};

type NodeKey =
  | "social"
  | "session"
  | "target"
  | "action";

type Platform = "facebook" | "instagram" | "threads";

/* ---------- icon node shell ---------- */

function IconNode({
  icon: Icon,
  label,
  active,
  iconClassName,
  onOpen,
  onDelete,
  showLeft = true,
  showRight = true,
  renderIcon,
}: {
  icon?: LucideIcon;
  label: string;
  active?: boolean;
  iconClassName?: string;
  onOpen: () => void;
  onDelete?: () => void;
  showLeft?: boolean;
  showRight?: boolean;
  renderIcon?: () => React.ReactNode;
}) {
  return (
    <div className="group relative flex w-28 flex-col items-center">
      {showLeft && (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2.5 !border-2 !border-zinc-600 !bg-zinc-900"
          style={{ top: "44px" }}
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        className={`flex size-22 cursor-pointer items-center justify-center rounded-2xl border bg-card shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${
          active
            ? "border-emerald-500 ring-2 ring-emerald-500/30"
            : "border-border"
        }`}
        style={{ width: 88, height: 88 }}
        title={`${label} — click to configure`}
      >
        {renderIcon ? (
          renderIcon()
        ) : Icon ? (
          <Icon className={`size-9 ${iconClassName ?? "text-zinc-700"}`} />
        ) : null}
      </button>
      <span className="mt-2 max-w-[7rem] text-center text-[12px] font-medium leading-tight text-foreground">
        {label}
      </span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -right-1 top-0 hidden size-5 items-center justify-center rounded-full border border-border bg-card text-xs text-muted-foreground shadow-sm hover:text-destructive group-hover:flex"
          title="Delete node"
          aria-label="Delete node"
        >
          ✕
        </button>
      )}
      {showRight && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !border-2 !border-zinc-600 !bg-zinc-900"
          style={{ top: "44px" }}
        />
      )}
    </div>
  );
}

function NodeDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- node bodies (icon + dialog) ---------- */

function SocialMediaNode({ id, data }: NodeProps) {
  const d = data as {
    state: RunState;
    platform: Platform;
    onPlatformChange: (id: string, p: Platform) => void;
    onDelete: (id: string) => void;
  };
  const [open, setOpen] = useState(false);
  type PlatformDef = {
    id: Platform;
    label: string;
    icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
    soon?: boolean;
  };
  const platforms: PlatformDef[] = [
    { id: "facebook", label: "Facebook", icon: FacebookIcon },
    { id: "instagram", label: "Instagram", icon: InstagramIcon, soon: true },
    { id: "threads", label: "Threads", icon: ThreadsIcon, soon: true },
  ];
  const current = platforms.find((p) => p.id === d.platform) ?? platforms[0];
  return (
    <>
      <IconNode
        label="Social Media"
        renderIcon={() => <FacebookIcon className="size-9 text-[#1877F2]" />}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
        showLeft={false}
      />
      <NodeDialog
        open={open}
        onOpenChange={setOpen}
        title="Social Media"
        description="Choose which platform this flow targets."
      >
        <div className="grid grid-cols-3 gap-2">
          {platforms.map((p) => {
            const Icon = p.icon;
            const selected = d.platform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={p.soon}
                onClick={() => d.onPlatformChange(id, p.id)}
                className={`relative flex flex-col items-center gap-2 rounded-md border p-3 text-xs transition-colors ${
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                    : "border-border hover:border-foreground/40"
                } ${p.soon ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <Icon className="size-6" />
                <span className="font-medium">{p.label}</span>
                {p.soon && (
                  <span className="absolute right-1 top-1 rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </NodeDialog>
    </>
  );
}

function SessionNode({ id, data }: NodeProps) {
  const d = data as {
    state: RunState;
    onLogin: () => void;
    onDelete: (id: string) => void;
  };
  const [open, setOpen] = useState(false);
  const has = d.state.status?.hasSession;
  return (
    <>
      <IconNode
        icon={KeyRound}
        iconClassName="text-amber-500"
        label="Session"
        active={d.state.active === "session"}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
      />
      <NodeDialog
        open={open}
        onOpenChange={setOpen}
        title="Session"
        description="Login + saved cookies for the target platform."
      >
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          {has ? "✓ Saved Facebook session" : "No session yet"}
        </div>
        <Button onClick={d.onLogin}>
          {has ? "Re-login" : "Login to Facebook"}
        </Button>
      </NodeDialog>
    </>
  );
}

function TargetNode({ id, data }: NodeProps) {
  const d = data as {
    state: RunState;
    url: string;
    onUrlChange: (id: string, v: string) => void;
    onDelete: (id: string) => void;
  };
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconNode
        icon={TargetIcon}
        iconClassName="text-rose-500"
        label="Target Page"
        active={d.state.active === "target"}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
      />
      <NodeDialog
        open={open}
        onOpenChange={setOpen}
        title="Target Page"
        description="The page that will receive follows / likes."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`target-url-${id}`} className="text-xs">
            URL to receive follows
          </Label>
          <Input
            id={`target-url-${id}`}
            placeholder="https://www.facebook.com/example/"
            value={d.url ?? ""}
            onChange={(e) => d.onUrlChange(id, e.target.value)}
          />
        </div>
      </NodeDialog>
    </>
  );
}

function ActionNode({ id, data }: NodeProps) {
  const d = data as { state: RunState; onDelete: (id: string) => void };
  const [open, setOpen] = useState(false);
  const r = d.state.lastResult;
  return (
    <>
      <IconNode
        icon={Heart}
        iconClassName="text-pink-500"
        label="Follow / Like"
        showRight={false}
        active={d.state.active === "action"}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
      />
      <NodeDialog
        open={open}
        onOpenChange={setOpen}
        title="Follow / Like"
        description="Tries Follow first, falls back to Like."
      >
        <div className="text-xs">
          Last result: <span className="font-mono">{r ?? "—"}</span>
        </div>
      </NodeDialog>
    </>
  );
}

const nodeTypes = {
  social: SocialMediaNode,
  session: SessionNode,
  target: TargetNode,
  action: ActionNode,
};

/* ---------- palette ---------- */

const PALETTE: Array<{
  type: NodeKey;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { type: "social", label: "Social Media", description: "Pick the platform", icon: Share2 },
  { type: "session", label: "Session", description: "Login + saved cookies", icon: KeyRound },
  { type: "target", label: "Target Page", description: "URL to receive follows", icon: TargetIcon },
  { type: "action", label: "Follow / Like", description: "Try Follow, fall back to Like", icon: Heart },
];

function PaletteItem({
  type,
  label,
  description,
  icon: Icon,
}: {
  type: NodeKey;
  label: string;
  description: string;
  icon: LucideIcon;
}) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-fbauto-node", type);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-background p-2 text-xs shadow-sm hover:border-foreground/40 active:cursor-grabbing"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate font-medium">{label}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {description}
        </div>
      </div>
    </div>
  );
}

/* ---------- main ---------- */

export default function AutomationFlow({ accountId = "default" }: { accountId?: string }) {
  return (
    <ReactFlowProvider>
      <FlowInner accountId={accountId} />
    </ReactFlowProvider>
  );
}

function FlowInner({ accountId }: { accountId: string }) {
  const qs = `?account=${encodeURIComponent(accountId)}`;
  const flow = useReactFlow();

  const [status, setStatus] = useState<Status | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [headed, setHeaded] = useState(false);
  const [fast, setFast] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let off = false;
    const tick = async () => {
      const r = await fetch(`/api/automation/status${qs}`, { cache: "no-store" });
      if (!off) setStatus(await r.json());
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      off = true;
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
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const { active, current, lastResult } = useMemo(() => {
    let a: NodeKey | null = null;
    let cur: RunState["current"];
    let last: string | undefined;
    for (let i = logs.length - 1; i >= 0; i--) {
      const e = logs[i];
      const m = e.message;
      if (!cur) {
        const mm = m.match(/^\[(\d+)\/(\d+)\]/);
        if (mm) cur = { i: Number(mm[1]), n: Number(mm[2]), source: e.source };
      }
      if (
        !last &&
        e.status &&
        ["followed", "liked", "already-following", "already-liked", "not-supported"].includes(
          e.status,
        )
      ) {
        last = e.status;
      }
      if (!a) {
        if (/navigating to target/i.test(m)) a = "action";
        else if (/follow|like|already-/i.test(e.status ?? "")) a = "action";
        else if (e.status === "stopped") a = null;
      }
      if (a && cur && last) break;
    }
    if (!status?.running) a = null;
    return { active: a, current: cur, lastResult: last };
  }, [logs, status?.running]);

  const state: RunState = useMemo(
    () => ({ status, config, logs, current, active, lastResult }),
    [status, config, logs, current, active, lastResult],
  );

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = useCallback(
    (urls: string[]) => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(async () => {
        await fetch(`/api/targets${qs}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUrls: urls }),
        });
      }, 400);
    },
    [qs],
  );

  const setNodesRef = useRef<((updater: (nds: Node[]) => Node[]) => void) | null>(null);

  const onTargetUrlChange = useCallback(
    (nodeId: string, v: string) => {
      setNodesRef.current?.((nds) => {
        const next = nds.map((n) =>
          n.id === nodeId && n.type === "target"
            ? { ...n, data: { ...n.data, url: v } }
            : n,
        );
        const urls = next
          .filter((n) => n.type === "target")
          .map((n) => String((n.data as { url?: string }).url ?? "").trim())
          .filter(Boolean);
        scheduleSync(urls);
        return next;
      });
    },
    [scheduleSync],
  );

  const onPlatformChange = useCallback((nodeId: string, p: Platform) => {
    if (p !== "facebook") return;
    setNodesRef.current?.((nds) =>
      nds.map((n) =>
        n.id === nodeId && n.type === "social"
          ? { ...n, data: { ...n.data, platform: p } }
          : n,
      ),
    );
  }, []);

  const post = useCallback(
    async (path: string, body?: unknown) => {
      const res = await fetch(`${path}${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { reason?: string };
        const map: Record<string, string> = {
          "already-running": "A run is already in progress.",
          "no-session": "Login to Facebook first.",
          "no-target": "Set the Target Page URL first.",
          "not-running": "Nothing is running.",
        };
        toast.error(map[data.reason ?? ""] ?? `Request failed (${res.status})`);
      }
    },
    [qs],
  );

  const onLogin = useCallback(() => post("/api/login"), [post]);
  const onStart = useCallback(
    () =>
      post("/api/automation/start", {
        headless: !headed,
        speed: fast ? "fast" : "normal",
      }),
    [post, headed, fast],
  );
  const onStop = useCallback(() => post("/api/automation/stop"), [post]);

  const deleteNodeRef = useRef<(id: string) => void>(() => {});

  const dataFor = useCallback(
    (id: string): Record<string, unknown> => {
      const onDelete = (nodeId: string) => deleteNodeRef.current(nodeId);
      const type = id.split("-")[0];
      switch (type) {
        case "social":
          return { state, platform: "facebook" as Platform, onPlatformChange, onDelete };
        case "session":
          return { state, onLogin, onDelete };
        case "target":
          return { state, onUrlChange: onTargetUrlChange, onDelete };
        default:
          return { state, onDelete };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, headed, fast, onLogin, onStart, onStop, onTargetUrlChange, onPlatformChange],
  );

  const initialNodes = useMemo<Node[]>(() => {
    const layout: Array<{ id: string; type: string; x: number; y: number }> = [
      { id: "social", type: "social", x: -200, y: 0 },
      { id: "session", type: "session", x: 0, y: 0 },
      { id: "target", type: "target", x: 200, y: 0 },
      { id: "action", type: "action", x: 400, y: 180 },
    ];
    return layout.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.x, y: n.y },
      data: dataFor(n.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialEdges = useMemo<Edge[]>(
    () => [
      { id: "e0", source: "social", target: "session" },
      { id: "e1", source: "session", target: "target" },
      { id: "e2", source: "target", target: "action" },
    ],
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodesRef.current = setNodes;
  }, [setNodes]);

  useEffect(() => {
    deleteNodeRef.current = (id: string) => {
      setNodes((nds) => {
        const next = nds.filter((n) => n.id !== id);
        if (nds.find((n) => n.id === id)?.type === "target") {
          const urls = next
            .filter((n) => n.type === "target")
            .map((n) => String((n.data as { url?: string }).url ?? "").trim())
            .filter(Boolean);
          scheduleSync(urls);
        }
        return next;
      });
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    };
  }, [setNodes, setEdges, scheduleSync]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({ ...n, data: { ...n.data, ...dataFor(n.id) } })),
    );
  }, [dataFor, setNodes]);

  const seededTargetsRef = useRef(false);
  useEffect(() => {
    if (seededTargetsRef.current || !config) return;
    const urls = config.targetUrls?.length
      ? config.targetUrls
      : config.targetUrl
        ? [config.targetUrl]
        : [];
    if (urls.length === 0) return;
    seededTargetsRef.current = true;
    setNodes((prev) => {
      const targets = prev.filter((n) => n.type === "target");
      let i = 0;
      const updated = prev.map((n) => {
        if (n.type !== "target") return n;
        const url = urls[i] ?? "";
        i++;
        return { ...n, data: { ...n.data, url } };
      });
      if (urls.length > targets.length) {
        const startX = 200;
        const startY = 0;
        for (let k = targets.length; k < urls.length; k++) {
          updated.push({
            id: `target-${Date.now().toString(36)}-${k}`,
            type: "target",
            position: { x: startX + k * 40, y: startY + (k - targets.length + 1) * 220 },
            data: { ...dataFor("target"), url: urls[k] },
          });
        }
      }
      return updated;
    });
  }, [config, dataFor, setNodes]);

  useEffect(() => {
    setEdges((prev) => prev.map((e) => ({ ...e, animated: !!status?.running })));
  }, [status?.running, setEdges]);

  const ALLOWED_CONNECTIONS: Record<string, string> = {
    social: "session",
    session: "target",
    target: "action",
  };

  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      if (!conn.source || !conn.target) return false;
      const src = nodes.find((n) => n.id === conn.source);
      const tgt = nodes.find((n) => n.id === conn.target);
      if (!src?.type || !tgt?.type) return false;
      return ALLOWED_CONNECTIONS[src.type] === tgt.type;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!isValidConnection(conn)) return;
      setEdges((eds) => addEdge({ ...conn, animated: !!status?.running }, eds));
    },
    [setEdges, status?.running, isValidConnection],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/x-fbauto-node") as NodeKey;
      if (!type || !nodeTypes[type as keyof typeof nodeTypes]) return;
      const position = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `${type}-${Date.now().toString(36)}`;
      const baseData = dataFor(type);
      const data =
        type === "target"
          ? { ...baseData, url: "" }
          : type === "social"
            ? { ...baseData, platform: "facebook" as Platform }
            : baseData;
      const newNode: Node = { id, type, position, data };
      setNodes((nds) => [...nds, newNode]);
    },
    [flow, dataFor, setNodes],
  );

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Automation Flow</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              status?.running ? "bg-emerald-500" : "bg-zinc-400"
            }`}
          />
          {status?.running ? "Running" : "Idle"}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[200px_1fr_360px]">
        <aside className="flex min-h-0 flex-col gap-2 rounded-lg border bg-background p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nodes
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto">
            {PALETTE.map((p) => (
              <PaletteItem key={p.type} {...p} />
            ))}
          </div>
          <p className="mt-auto text-[10px] text-muted-foreground">
            Drag onto the canvas. Click a node icon to configure it. Connect handles
            to wire them. Select an edge or node and press Backspace to delete.
          </p>
        </aside>

        <div
          className="min-h-0 overflow-hidden rounded-lg border bg-background"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background />
            <Controls>
              <ControlButton
                onClick={onStart}
                disabled={!!status?.running || !status?.hasSession}
                title={
                  !status?.hasSession
                    ? "Login first"
                    : status?.running
                      ? "Already running"
                      : "Start"
                }
              >
                <Play className="size-3.5 text-emerald-600" />
              </ControlButton>
              <ControlButton
                onClick={onStop}
                disabled={!status?.running}
                title="Stop"
              >
                <Square className="size-3.5 text-rose-600" />
              </ControlButton>
              <ControlButton
                onClick={() => setHeaded((v) => !v)}
                title={headed ? "Hide browser" : "Show browser"}
              >
                {headed ? (
                  <Eye className="size-3.5 text-sky-600" />
                ) : (
                  <EyeOff className="size-3.5" />
                )}
              </ControlButton>
              <ControlButton
                onClick={() => setFast((v) => !v)}
                title={fast ? "Fast mode (on)" : "Fast mode (off)"}
              >
                {fast ? (
                  <Zap className="size-3.5 text-amber-500" />
                ) : (
                  <ZapOff className="size-3.5" />
                )}
              </ControlButton>
            </Controls>
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <aside className="flex min-h-0 flex-col rounded-lg border bg-background p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Logs
          </div>
          <div
            ref={logsRef}
            className="min-h-0 flex-1 overflow-y-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
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
        </aside>
      </div>
    </div>
  );
}
