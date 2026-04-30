"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type NodeKey = "session" | "target" | "discover" | "loop" | "switch" | "action" | "control";

/* ---------- node bodies ---------- */

function NodeShell({
  title,
  active,
  onDelete,
  children,
}: {
  title: string;
  active?: boolean;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group min-w-60 max-w-72 rounded-lg border bg-background shadow-md transition-colors ${
        active ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border"
      }`}
    >
      <div className="flow-drag-handle flex cursor-move select-none items-center justify-between rounded-t-lg border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            title="Delete node"
            aria-label="Delete node"
          >
            <span className="text-xs leading-none">✕</span>
          </button>
        )}
      </div>
      <div className="p-3 text-sm">{children}</div>
    </div>
  );
}

function SessionNode({ id, data }: NodeProps) {
  const d = data as { state: RunState; onLogin: () => void; onDelete: (id: string) => void };
  const has = d.state.status?.hasSession;
  return (
    <NodeShell title="Session" active={d.state.active === "session"} onDelete={() => d.onDelete(id)}>
      <div className="flex flex-col gap-2">
        <div className="text-xs">
          {has ? "✓ Saved Facebook session" : "No session yet"}
        </div>
        <Button size="sm" onClick={d.onLogin}>
          {has ? "Re-login" : "Login to Facebook"}
        </Button>
      </div>
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function TargetNode({ id, data }: NodeProps) {
  const d = data as {
    state: RunState;
    url: string;
    onUrlChange: (id: string, v: string) => void;
    onDelete: (id: string) => void;
  };
  return (
    <NodeShell title="Target Page" active={d.state.active === "target"} onDelete={() => d.onDelete(id)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`target-url-${id}`} className="text-xs">
          URL to receive follows
        </Label>
        <Input
          id={`target-url-${id}`}
          className="h-8 text-xs"
          placeholder="https://www.facebook.com/example/"
          value={d.url ?? ""}
          onChange={(e) => d.onUrlChange(id, e.target.value)}
        />
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function DiscoverNode({ id, data }: NodeProps) {
  const d = data as { state: RunState; onDelete: (id: string) => void };
  const sources = d.state.config?.sources ?? [];
  return (
    <NodeShell title="Discover Pages" active={d.state.active === "discover"} onDelete={() => d.onDelete(id)}>
      <div className="text-xs text-muted-foreground">
        Opens avatar → &quot;See all profiles&quot; → expands and scrapes tile names.
      </div>
      <div className="mt-2 text-xs">
        Detected:{" "}
        <span className="font-mono">
          {sources.length > 0 ? sources.length : "auto on run"}
        </span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function LoopNode({ id, data }: NodeProps) {
  const d = data as { state: RunState; onDelete: (id: string) => void };
  const c = d.state.current;
  return (
    <NodeShell title="For each Page" active={d.state.active === "loop"} onDelete={() => d.onDelete(id)}>
      <div className="text-xs">
        {c
          ? `Iteration ${c.i}/${c.n}${c.source ? ` — ${c.source}` : ""}`
          : "Idle"}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function SwitchNode({ id, data }: NodeProps) {
  const d = data as { state: RunState; onDelete: (id: string) => void };
  return (
    <NodeShell title="Switch Identity" active={d.state.active === "switch"} onDelete={() => d.onDelete(id)}>
      <div className="text-xs">
        {d.state.current?.source ? (
          <>
            Now as <span className="font-mono">{d.state.current.source}</span>
          </>
        ) : (
          "Waiting"
        )}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function ActionNode({ id, data }: NodeProps) {
  const d = data as { state: RunState; onDelete: (id: string) => void };
  const r = d.state.lastResult;
  return (
    <NodeShell title="Follow / Like" active={d.state.active === "action"} onDelete={() => d.onDelete(id)}>
      <div className="text-xs">
        Tries <span className="font-mono">Follow</span>, falls back to{" "}
        <span className="font-mono">Like</span>.
      </div>
      <div className="mt-1 text-xs">
        Last:{" "}
        <span className="font-mono">{r ?? "—"}</span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

function ControlNode({ id, data }: NodeProps) {
  const d = data as {
    state: RunState;
    headed: boolean;
    fast: boolean;
    onHeaded: (v: boolean) => void;
    onFast: (v: boolean) => void;
    onStart: () => void;
    onStop: () => void;
    onDelete: (id: string) => void;
  };
  const running = d.state.status?.running;
  return (
    <NodeShell title="Control" active={running ?? false} onDelete={() => d.onDelete(id)}>
      <div className="flex flex-col gap-2 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={d.headed}
            onChange={(e) => d.onHeaded(e.target.checked)}
          />
          Show browser
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={d.fast}
            onChange={(e) => d.onFast(e.target.checked)}
          />
          Fast mode
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={running || !d.state.status?.hasSession}
            onClick={d.onStart}
          >
            Start
          </Button>
          <Button size="sm" variant="outline" disabled={!running} onClick={d.onStop}>
            Stop
          </Button>
        </div>
      </div>
      <Handle type="target" position={Position.Left} />
    </NodeShell>
  );
}

const nodeTypes = {
  session: SessionNode,
  target: TargetNode,
  discover: DiscoverNode,
  loop: LoopNode,
  switch: SwitchNode,
  action: ActionNode,
  control: ControlNode,
};

/* ---------- palette ---------- */

const PALETTE: Array<{ type: NodeKey; label: string; description: string }> = [
  { type: "session", label: "Session", description: "Login + saved cookies" },
  { type: "target", label: "Target Page", description: "URL to receive follows" },
  { type: "discover", label: "Discover Pages", description: "Scrape switcher tiles" },
  { type: "loop", label: "For each Page", description: "Iterate sources" },
  { type: "switch", label: "Switch Identity", description: "Click a profile tile" },
  { type: "action", label: "Follow / Like", description: "Try Follow, fall back to Like" },
  { type: "control", label: "Control", description: "Start / stop / mode toggles" },
];

function PaletteItem({
  type,
  label,
  description,
}: {
  type: NodeKey;
  label: string;
  description: string;
}) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-fbauto-node", type);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-md border border-border bg-background p-2 text-xs shadow-sm hover:border-foreground/40 active:cursor-grabbing"
    >
      <div className="font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">{description}</div>
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

  // poll status
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

  // load config
  useEffect(() => {
    fetch(`/api/targets${qs}`)
      .then((r) => r.json())
      .then(setConfig);
  }, [qs]);

  // SSE log stream
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

  // derive active node + current iteration from log tail
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
      if (!last && e.status && ["followed", "liked", "already-following", "already-liked", "not-supported"].includes(e.status)) {
        last = e.status;
      }
      if (!a) {
        if (e.status === "started") a = "control";
        else if (/discover/i.test(m)) a = "discover";
        else if (/switching to/i.test(m)) a = "switch";
        else if (/navigating to target/i.test(m)) a = "action";
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

  // Debounced sync — collects all Target node URLs and PUTs them.
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

  // Per-Target-node URL update.
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

  // Forward-declared so dataFor can reference setNodes before it exists.
  const setNodesRef = useRef<((updater: (nds: Node[]) => Node[]) => void) | null>(null);

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
        alert(map[data.reason ?? ""] ?? `Request failed (${res.status})`);
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

  // Forward-declared so dataFor can close over it; assigned once setNodes/setEdges exist.
  const deleteNodeRef = useRef<(id: string) => void>(() => {});

  const dataFor = useCallback(
    (id: string): Record<string, unknown> => {
      const onDelete = (nodeId: string) => deleteNodeRef.current(nodeId);
      // The node's *type* drives data shape, not its id — derive type from id prefix.
      const type = id.split("-")[0];
      switch (type) {
        case "session":
          return { state, onLogin, onDelete };
        case "target":
          return { state, onUrlChange: onTargetUrlChange, onDelete };
        case "control":
          return {
            state,
            headed,
            fast,
            onHeaded: setHeaded,
            onFast: setFast,
            onStart,
            onStop,
            onDelete,
          };
        default:
          return { state, onDelete };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, headed, fast, onLogin, onStart, onStop, onTargetUrlChange],
  );

  const initialNodes = useMemo<Node[]>(() => {
    const dragHandle = ".flow-drag-handle";
    const layout: Array<{ id: string; type: string; x: number; y: number }> = [
      { id: "session", type: "session", x: 0, y: 0 },
      { id: "target", type: "target", x: 320, y: 0 },
      { id: "discover", type: "discover", x: 640, y: 0 },
      { id: "loop", type: "loop", x: 960, y: 0 },
      { id: "switch", type: "switch", x: 320, y: 220 },
      { id: "action", type: "action", x: 640, y: 220 },
      { id: "control", type: "control", x: 960, y: 220 },
    ];
    return layout.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.x, y: n.y },
      dragHandle,
      data: dataFor(n.id),
    }));
    // initial layout only — data is refreshed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialEdges = useMemo<Edge[]>(
    () => [
      { id: "e1", source: "session", target: "target" },
      { id: "e2", source: "target", target: "discover" },
      { id: "e3", source: "discover", target: "loop" },
      { id: "e4", source: "loop", target: "switch" },
      { id: "e5", source: "switch", target: "action" },
      { id: "e6", source: "action", target: "control" },
    ],
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Expose setNodes via ref so callbacks defined before useNodesState can use it.
  useEffect(() => {
    setNodesRef.current = setNodes;
  }, [setNodes]);

  useEffect(() => {
    deleteNodeRef.current = (id: string) => {
      setNodes((nds) => {
        const next = nds.filter((n) => n.id !== id);
        // If we removed a Target, re-sync the URL list to the server.
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

  // Refresh node data whenever derived state changes — merges new props
  // over existing data so per-node fields (like target.url) survive.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({ ...n, data: { ...n.data, ...dataFor(n.id) } })),
    );
  }, [dataFor, setNodes]);

  // First time config arrives, seed Target node URLs from config.targetUrls.
  const seededTargetsRef = useRef(false);
  useEffect(() => {
    if (seededTargetsRef.current || !config) return;
    const urls = config.targetUrls?.length ? config.targetUrls : config.targetUrl ? [config.targetUrl] : [];
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
      // If config has more URLs than existing Target nodes, add the rest.
      if (urls.length > targets.length) {
        const startX = 320;
        const startY = 0;
        for (let k = targets.length; k < urls.length; k++) {
          updated.push({
            id: `target-${Date.now().toString(36)}-${k}`,
            type: "target",
            position: { x: startX + k * 40, y: startY + (k - targets.length + 1) * 220 },
            dragHandle: ".flow-drag-handle",
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

  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) =>
        addEdge({ ...conn, animated: !!status?.running }, eds),
      ),
    [setEdges, status?.running],
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
      const data = type === "target" ? { ...baseData, url: "" } : baseData;
      const newNode: Node = {
        id,
        type,
        position,
        dragHandle: ".flow-drag-handle",
        data,
      };
      setNodes((nds) => [...nds, newNode]);
      if (type === "target") {
        // New empty target — sync nothing yet (no URL), but ensure subsequent
        // edits include this slot. The change will fire scheduleSync on edit.
      }
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
            Drag onto the canvas. Connect handles to wire them. Select an edge or
            node and press Backspace to delete.
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
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background />
            <Controls />
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
