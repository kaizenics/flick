"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionLineType,
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
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  KeyRound,
  Target as TargetIcon,
  Heart,
  Smile,
  Play,
  Square,
  Check,
  X,
  Loader2,
  Plus,
  Save,
  Search,
  Newspaper,
  ChevronsUpDown,
  ChevronDown,
  Trash2,
  Blocks,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";

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
  | "targetPost"
  | "action"
  | "reactions";

type ReactionKind = "like" | "love" | "haha" | "wow" | "sad" | "angry";

const REACTION_OPTIONS: Array<{ id: ReactionKind; label: string }> = [
  { id: "like", label: "Like" },
  { id: "love", label: "Love" },
  { id: "haha", label: "Haha" },
  { id: "wow", label: "Wow" },
  { id: "sad", label: "Sad" },
  { id: "angry", label: "Angry" },
];

type Platform = "facebook" | "instagram" | "threads";

const PLATFORMS: Array<{
  id: Platform;
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  soon?: boolean;
}> = [
  { id: "facebook", label: "Facebook", icon: FacebookIcon },
  { id: "instagram", label: "Instagram", icon: InstagramIcon, soon: true },
  { id: "threads", label: "Threads", icon: ThreadsIcon, soon: true },
];

/* ---------- node catalogue ---------- */

type NodeMeta = {
  label: string;
  description: string;
  group: "Trigger" | "Account" | "Targets" | "Actions";
  icon: React.ComponentType<{ className?: string }>;
  input: boolean;
  output: boolean;
  /** Pipeline depth, used to light nodes up as a run moves through them. */
  rank: number;
};

const NODE_META: Record<NodeKey, NodeMeta> = {
  social: { label: "Social media", description: "Pick the platform", group: "Trigger", icon: FacebookIcon, input: false, output: true, rank: 0 },
  session: { label: "Session", description: "Login and saved cookies", group: "Account", icon: KeyRound, input: true, output: true, rank: 1 },
  target: { label: "Target page", description: "Page that receives follows", group: "Targets", icon: TargetIcon, input: true, output: true, rank: 2 },
  targetPost: { label: "Target post", description: "Post that receives reactions", group: "Targets", icon: Newspaper, input: true, output: true, rank: 2 },
  action: { label: "Follow or like", description: "Tries Follow, falls back to Like", group: "Actions", icon: Heart, input: true, output: false, rank: 3 },
  reactions: { label: "Reactions", description: "Drops a reaction on the post", group: "Actions", icon: Smile, input: true, output: false, rank: 3 },
};

const NODE_KEYS = Object.keys(NODE_META) as NodeKey[];
const GROUPS: NodeMeta["group"][] = ["Trigger", "Account", "Targets", "Actions"];

const NODE_DEFAULTS: Partial<Record<NodeKey, Record<string, unknown>>> = {
  social: { platform: "facebook" },
  target: { url: "" },
  targetPost: { url: "" },
  reactions: { reaction: "like" },
};

type RunStatus = "idle" | "running" | "done" | "error";

// Derived from the live status poll + log stream: nodes upstream of the step
// the runner is on are done, the current step runs, the rest wait.
function runStatus(type: NodeKey, s: RunState | undefined): RunStatus {
  if (!s) return "idle";
  const rank = NODE_META[type].rank;
  if (s.status?.running) {
    const at = s.active ? NODE_META[s.active].rank : 2;
    return rank < at ? "done" : rank === at ? "running" : "idle";
  }
  // shortcut: the log stream does not say which node failed, so an error at the
  // end of the last run is pinned on the action nodes.
  if (s.logs[s.logs.length - 1]?.level === "error" && rank === 3) return "error";
  return "idle";
}

function shortUrl(u: string) {
  try {
    const url = new URL(u);
    return `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return u;
  }
}

type NodeData = {
  state?: RunState;
  url?: string;
  reaction?: ReactionKind;
  platform?: Platform;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
};

function nodeSummary(type: NodeKey, d: NodeData): string {
  switch (type) {
    case "social":
      return PLATFORMS.find((p) => p.id === d.platform)?.label ?? "Facebook";
    case "session":
      return d.state?.status?.hasSession ? "Saved session" : "Not logged in";
    case "target":
    case "targetPost":
      return d.url ? shortUrl(d.url) : "No URL set";
    case "action":
      return d.state?.lastResult ?? "Follow, else like";
    case "reactions":
      return REACTION_OPTIONS.find((r) => r.id === d.reaction)?.label ?? "Like";
  }
}

function StatusMark({ status }: { status: RunStatus }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full",
        status === "done" && "bg-data text-black",
        status === "error" && "bg-danger-tint text-danger-ink",
        status === "running" && "text-white",
        status === "idle" && "bg-raised",
      )}
      aria-label={status}
      title={status}
    >
      {status === "done" && <Check className="size-3" strokeWidth={3} />}
      {status === "error" && <X className="size-3" strokeWidth={3} />}
      {status === "running" && <Loader2 className="size-4 animate-spin" />}
      {status === "idle" && <span className="size-1.5 rounded-full bg-faint" />}
    </span>
  );
}

/* ---------- node card ---------- */

const handleClass =
  "!size-3 !border-2 !border-faint !bg-black transition-colors hover:!border-white";

function FlowNode({ id, type, data, selected }: NodeProps) {
  const key = type as NodeKey;
  const d = data as NodeData;
  const meta = NODE_META[key];
  const status = runStatus(key, d.state);
  const Icon = meta.icon;
  const cur = d.state?.current;
  return (
    <div
      className={cn(
        "group relative flex w-[184px] flex-col gap-3 rounded-2xl border bg-card p-3.5 transition-colors",
        status === "running" && "border-white",
        status === "done" && "border-data/60",
        status === "error" && "border-danger-ink",
        status === "idle" && (selected ? "border-faint" : "border-raised hover:border-faint/60"),
        selected && "outline-2 outline-offset-4 outline-white/30",
      )}
    >
      {meta.input && <Handle type="target" position={Position.Left} className={handleClass} />}
      <div className="flex items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-lg bg-black text-white">
          <Icon className="size-4" />
        </span>
        <StatusMark status={status} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2 text-sm font-medium text-white">
          <span className="truncate">{meta.label}</span>
          {status === "running" && cur && (
            <span className="num text-xs font-normal text-muted-foreground">
              {cur.i}/{cur.n}
            </span>
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">{nodeSummary(key, d)}</span>
      </div>
      {d.onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            d.onDelete?.(id);
          }}
          className="nodrag absolute -top-2.5 -right-2.5 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger-ink focus-visible:opacity-100"
          title="Delete node"
          aria-label="Delete node"
        >
          <X className="size-3" />
        </button>
      )}
      {meta.output && <Handle type="source" position={Position.Right} className={handleClass} />}
      {meta.output && d.onAdd && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            d.onAdd?.();
          }}
          className="nodrag absolute top-1/2 left-full ml-4 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-white hover:text-white focus-visible:opacity-100"
          title="Add next node"
          aria-label="Add next node"
        >
          <Plus className="size-3" />
        </button>
      )}
    </div>
  );
}

const nodeTypes = {
  social: FlowNode,
  session: FlowNode,
  target: FlowNode,
  targetPost: FlowNode,
  action: FlowNode,
  reactions: FlowNode,
};

/* ---------- main ---------- */

export default function AutomationFlow({ accountId = "default" }: { accountId?: string }) {
  return (
    <ReactFlowProvider>
      <FlowInner accountId={accountId} />
    </ReactFlowProvider>
  );
}

function WorkflowTitle({
  name,
  disabled,
  onRename,
}: {
  name: string;
  disabled?: boolean;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label="Workflow name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="h-8 w-28 min-w-0 rounded-full border border-border bg-black px-3 text-[18px] font-semibold outline-none focus:border-faint sm:w-48"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      className="h-8 max-w-[9rem] truncate rounded-full px-2.5 text-base sm:max-w-[16rem] sm:text-[18px] font-semibold text-white hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60"
      title={disabled ? undefined : "Rename workflow"}
    >
      {name}
    </button>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border px-5 py-5 first:border-t-0">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      {children}
    </section>
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
  const [showLogs, setShowLogs] = useState(true);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [workflows, setWorkflows] = useState<
    Array<{ id: string; name: string; updatedAt: number }>
  >([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const loadedWorkflowRef = useRef<string | null>(null);
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
  }, [logs, showLogs]);

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
    (payload: { targetUrls?: string[]; posts?: Array<{ url: string; reaction: ReactionKind }> }) => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(async () => {
        await fetch(`/api/targets${qs}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }, 400);
    },
    [qs],
  );

  const collectPosts = useCallback((nds: Node[]) => {
    return nds
      .filter((n) => n.type === "targetPost")
      .map((n) => {
        const d = n.data as { url?: string; reaction?: ReactionKind };
        return { url: String(d.url ?? "").trim(), reaction: (d.reaction ?? "like") as ReactionKind };
      })
      .filter((p) => p.url.length > 0);
  }, []);

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
        scheduleSync({ targetUrls: urls });
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

  const onPostUrlChange = useCallback(
    (nodeId: string, v: string) => {
      setNodesRef.current?.((nds) => {
        const next = nds.map((n) =>
          n.id === nodeId && n.type === "targetPost"
            ? { ...n, data: { ...n.data, url: v } }
            : n,
        );
        scheduleSync({ posts: collectPosts(next) });
        return next;
      });
    },
    [scheduleSync, collectPosts],
  );

  const onReactionChange = useCallback(
    (nodeId: string, r: ReactionKind) => {
      setNodesRef.current?.((nds) => {
        const next = nds.map((n) =>
          n.id === nodeId && n.type === "reactions"
            ? { ...n, data: { ...n.data, reaction: r } }
            : n,
        );
        // Reactions live on the reactions node, but posts on targetPost. The
        // changed node's kind is applied to every target post at sync time.
        const reactionForAll = r;
        const posts = next
          .filter((n) => n.type === "targetPost")
          .map((n) => ({
            url: String((n.data as { url?: string }).url ?? "").trim(),
            reaction: reactionForAll,
          }))
          .filter((p) => p.url.length > 0);
        scheduleSync({ posts });
        return next;
      });
    },
    [scheduleSync],
  );

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
          "no-target": "Set a Target URL first.",
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

  const deleteNodeRef = useRef<(id: string) => void>(() => { });
  const addPickerRef = useRef<(sourceId: string) => void>(() => { });
  const [pickerSourceId, setPickerSourceId] = useState<string | null>(null);

  // Config edits go through the inspector; nodes only carry run state and
  // their hover delete / add-next handlers.
  const dataFor = useCallback(
    (id: string): Record<string, unknown> => ({
      state,
      onDelete: (nodeId: string) => deleteNodeRef.current(nodeId),
      onAdd: () => addPickerRef.current(id),
    }),
    [state],
  );

  useEffect(() => {
    addPickerRef.current = (sourceId) => setPickerSourceId(sourceId);
  }, []);

  const initialNodes = useMemo<Node[]>(() => [], []);
  const initialEdges = useMemo<Edge[]>(() => [], []);

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
          scheduleSync({ targetUrls: urls });
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

  // Edges are styled from node run status at render time (not stored), so a
  // run never leaks animation flags into the saved workflow.
  const viewEdges = useMemo<Edge[]>(() => {
    const typeOf = new Map(nodes.map((n) => [n.id, n.type as NodeKey]));
    return edges.map((e) => {
      const s = typeOf.get(e.source);
      const t = typeOf.get(e.target);
      const from = s ? runStatus(s, state) : "idle";
      const to = t ? runStatus(t, state) : "idle";
      const flowing = to === "running" && from !== "idle";
      const passed = from === "done" && to === "done";
      return {
        ...e,
        type: "smoothstep",
        animated: flowing,
        style: {
          stroke: flowing || passed ? "var(--data)" : to === "error" ? "var(--danger-ink)" : "#3a3a3a",
          strokeWidth: 2,
        },
      };
    });
  }, [edges, nodes, state]);

  const refreshWorkflows = useCallback(async () => {
    const r = await fetch("/api/workflows", { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { items: Array<{ id: string; name: string; updatedAt: number }> };
    setWorkflows(j.items);
    return j.items;
  }, []);

  const starterData = useMemo(
    () => ({
      nodes: [
        {
          id: "social",
          type: "social",
          position: { x: 0, y: 0 },
          data: { platform: "facebook" },
        },
      ],
      edges: [],
    }),
    [],
  );

  // Initial load: fetch list, auto-select most recent or create blank.
  useEffect(() => {
    let off = false;
    (async () => {
      const items = await refreshWorkflows();
      if (off || !items) return;
      if (items.length > 0) {
        setActiveWorkflowId(items[0].id);
      } else {
        const r = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "My workflow", data: starterData }),
        });
        if (r.ok) {
          const j = (await r.json()) as { id: string; name: string; updatedAt: number };
          if (!off) {
            setWorkflows([{ id: j.id, name: j.name, updatedAt: j.updatedAt }]);
            setActiveWorkflowId(j.id);
            loadedWorkflowRef.current = j.id;
          }
        }
      }
    })();
    return () => {
      off = true;
    };
  }, [refreshWorkflows, starterData]);

  // Load nodes/edges when active workflow changes.
  useEffect(() => {
    if (!activeWorkflowId || activeWorkflowId === loadedWorkflowRef.current) return;
    let off = false;
    (async () => {
      const r = await fetch(`/api/workflows/${activeWorkflowId}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { id: string; name: string; data: { nodes: Node[]; edges: Edge[] } };
      if (off) return;
      loadedWorkflowRef.current = j.id;
      const nodesIn = j.data?.nodes ?? [];
      const edgesIn = j.data?.edges ?? [];
      setSelectedId(null);
      setNodes(
        nodesIn.map((n) => ({ ...n, selected: false, data: { ...n.data, ...dataFor(n.id) } })),
      );
      setEdges(edgesIn);
      requestAnimationFrame(() => flow.fitView({ padding: 0.3, maxZoom: 1 }));

      // Mirror the loaded workflow's pages + posts to the runner's
      // per-account targets file so the automation backend sees them
      // even if the user hasn't re-edited the inputs since last load.
      const targetUrls = nodesIn
        .filter((n) => n.type === "target")
        .map((n) => String((n.data as { url?: string }).url ?? "").trim())
        .filter((u) => u.length > 0);
      const reactionKind = (() => {
        const r = nodesIn.find((n) => n.type === "reactions");
        const k = (r?.data as { reaction?: ReactionKind } | undefined)?.reaction;
        return (k ?? "like") as ReactionKind;
      })();
      const posts = nodesIn
        .filter((n) => n.type === "targetPost")
        .map((n) => ({
          url: String((n.data as { url?: string }).url ?? "").trim(),
          reaction: reactionKind,
        }))
        .filter((p) => p.url.length > 0);
      await fetch(`/api/targets${qs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrls, posts }),
      }).catch(() => {});
    })();
    return () => {
      off = true;
    };
  }, [activeWorkflowId, setNodes, setEdges, dataFor, qs, flow]);

  // Save nodes/edges for the active workflow: debounced autosave + Save button.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(async () => {
    if (!activeWorkflowId || loadedWorkflowRef.current !== activeWorkflowId) return false;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // Strip non-serializable function fields from data.
    const cleanNodes = nodes.map((n) => {
      const d = (n.data ?? {}) as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(d)) {
        if (typeof v !== "function" && k !== "state") data[k] = v;
      }
      return { ...n, data };
    });
    const res = await fetch(`/api/workflows/${activeWorkflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { nodes: cleanNodes, edges } }),
    }).catch(() => null);
    return !!res?.ok;
  }, [nodes, edges, activeWorkflowId]);

  useEffect(() => {
    if (!activeWorkflowId || loadedWorkflowRef.current !== activeWorkflowId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveNow, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveNow, activeWorkflowId]);

  const createWorkflow = useCallback(async () => {
    const r = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled workflow", data: starterData }),
    });
    if (!r.ok) return;
    const j = (await r.json()) as { id: string; name: string; updatedAt: number };
    setWorkflows((ws) => [{ id: j.id, name: j.name, updatedAt: j.updatedAt }, ...ws]);
    loadedWorkflowRef.current = null;
    setActiveWorkflowId(j.id);
    setShowWorkflows(false);
  }, [starterData]);

  const deleteWorkflow = useCallback(
    async (id: string) => {
      await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      setWorkflows((ws) => ws.filter((w) => w.id !== id));
      if (activeWorkflowId === id) {
        loadedWorkflowRef.current = null;
        setActiveWorkflowId(null);
      }
    },
    [activeWorkflowId],
  );

  const renameWorkflow = useCallback(
    async (id: string, name: string) => {
      await fetch(`/api/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setWorkflows((ws) => ws.map((w) => (w.id === id ? { ...w, name } : w)));
    },
    [],
  );

  const ALLOWED_CONNECTIONS: Record<string, string[]> = useMemo(
    () => ({
      social: ["session"],
      session: ["target", "targetPost"],
      target: ["action"],
      targetPost: ["reactions"],
    }),
    [],
  );

  const pickerSource = useMemo(
    () => (pickerSourceId ? nodes.find((n) => n.id === pickerSourceId) ?? null : null),
    [pickerSourceId, nodes],
  );
  const pickerOptions = useMemo(() => {
    if (!pickerSource?.type) return [];
    const allowed = ALLOWED_CONNECTIONS[pickerSource.type] ?? [];
    return NODE_KEYS.filter((k) => allowed.includes(k));
  }, [pickerSource, ALLOWED_CONNECTIONS]);

  const newNode = useCallback(
    (type: NodeKey, position: XYPosition): Node => {
      const id = `${type}-${Date.now().toString(36)}`;
      return { id, type, position, data: { ...dataFor(id), ...NODE_DEFAULTS[type] } };
    },
    [dataFor],
  );

  const addNodeFromPicker = useCallback(
    (type: NodeKey) => {
      if (!pickerSource) return;
      const node = newNode(type, {
        x: pickerSource.position.x + 240,
        y: pickerSource.position.y,
      });
      setNodes((nds) => [...nds, node]);
      setEdges((eds) =>
        addEdge({ id: `e-${pickerSource.id}-${node.id}`, source: pickerSource.id, target: node.id }, eds),
      );
      setPickerSourceId(null);
      setSelectedId(node.id);
    },
    [pickerSource, newNode, setNodes, setEdges],
  );

  // Palette click: drop the node right of the right-most node.
  const addNodeFromPalette = useCallback(
    (type: NodeKey) => {
      const right = nodes.reduce<Node | null>(
        (best, n) => (!best || n.position.x > best.position.x ? n : best),
        null,
      );
      const node = newNode(type, right ? { x: right.position.x + 240, y: right.position.y } : { x: 0, y: 0 });
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
      setShowPalette(false);
    },
    [nodes, newNode, setNodes],
  );

  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      if (!conn.source || !conn.target) return false;
      const src = nodes.find((n) => n.id === conn.source);
      const tgt = nodes.find((n) => n.id === conn.target);
      if (!src?.type || !tgt?.type) return false;
      return ALLOWED_CONNECTIONS[src.type]?.includes(tgt.type) ?? false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!isValidConnection(conn)) return;
      setEdges((eds) => addEdge(conn, eds));
    },
    [setEdges, isValidConnection],
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
      const node = newNode(type, position);
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
    },
    [flow, newNode, setNodes],
  );

  const running = !!status?.running;
  const hasSession = !!status?.hasSession;
  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
  const workflowName =
    workflows.find((w) => w.id === activeWorkflowId)?.name ?? "Automation flow";

  /* ---------- palette ---------- */

  const q = paletteQuery.trim().toLowerCase();
  const paletteBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={paletteQuery}
            onChange={(e) => setPaletteQuery(e.target.value)}
            placeholder="Search nodes"
            aria-label="Search nodes"
            className="pl-9"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {GROUPS.map((group) => {
          const items = NODE_KEYS.filter(
            (k) =>
              NODE_META[k].group === group &&
              (!q || `${NODE_META[k].label} ${NODE_META[k].description}`.toLowerCase().includes(q)),
          );
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col pt-3">
              <span className="px-2 pb-1.5 text-xs text-faint">{group}</span>
              {items.map((k) => {
                const m = NODE_META[k];
                const Icon = m.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-fbauto-node", k);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => addNodeFromPalette(k)}
                    className="flex cursor-grab items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-raised active:cursor-grabbing"
                    title="Drag onto the canvas or click to add"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-white">{m.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{m.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {q && NODE_KEYS.every((k) => !`${NODE_META[k].label} ${NODE_META[k].description}`.toLowerCase().includes(q)) && (
          <p className="px-2 pt-3 text-sm text-muted-foreground">No node matches “{paletteQuery}”.</p>
        )}
      </div>
    </div>
  );

  /* ---------- inspector ---------- */

  const selType = selected?.type as NodeKey | undefined;
  const selData = (selected?.data ?? {}) as NodeData;

  const sessionBlock = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Facebook</span>
        {hasSession ? (
          <Badge variant="positive">
            <Check data-icon="inline-start" />
            Saved session
          </Badge>
        ) : (
          <Badge variant="warning">Not logged in</Badge>
        )}
      </div>
      <Button variant="outline" onClick={onLogin} className="self-start">
        {hasSession ? "Log in again" : "Log in to Facebook"}
      </Button>
    </>
  );

  const inspectorBody = selected && selType ? (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black text-white">
          {(() => {
            const Icon = NODE_META[selType].icon;
            return <Icon className="size-4" />;
          })()}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-base font-medium text-white">{NODE_META[selType].label}</h2>
          <p className="text-sm text-muted-foreground">{NODE_META[selType].description}.</p>
        </div>
        <StatusMark status={runStatus(selType, state)} />
      </div>

      <PanelSection title="Settings">
        {selType === "social" && (
          <div className="grid grid-cols-3 gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const on = (selData.platform ?? "facebook") === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={p.soon}
                  onClick={() => onPlatformChange(selected.id, p.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border bg-black px-2 py-3 text-xs transition-colors",
                    on ? "border-white text-white" : "border-border text-muted-foreground hover:border-faint",
                    p.soon && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="font-medium">{p.label}</span>
                  {p.soon && <span className="text-faint">Soon</span>}
                </button>
              );
            })}
          </div>
        )}
        {selType === "session" && sessionBlock}
        {(selType === "target" || selType === "targetPost") && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`node-url-${selected.id}`}>
              {selType === "target" ? "Page URL" : "Post URL"}
            </Label>
            <Input
              id={`node-url-${selected.id}`}
              placeholder={
                selType === "target"
                  ? "https://www.facebook.com/example/"
                  : "https://www.facebook.com/.../posts/123..."
              }
              value={selData.url ?? ""}
              onChange={(e) =>
                selType === "target"
                  ? onTargetUrlChange(selected.id, e.target.value)
                  : onPostUrlChange(selected.id, e.target.value)
              }
            />
            <p className="text-xs text-faint">
              {selType === "target"
                ? "The page that receives follows or likes."
                : "The post that receives reactions."}
            </p>
          </div>
        )}
        {selType === "action" && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Last result</span>
            <span className="font-mono text-white">{lastResult ?? "—"}</span>
          </div>
        )}
        {selType === "reactions" && (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Reaction">
            {REACTION_OPTIONS.map((r) => {
              const on = (selData.reaction ?? "like") === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onReactionChange(selected.id, r.id)}
                  className={cn(
                    "h-9 rounded-full border bg-black text-sm font-medium transition-colors",
                    on ? "border-white text-white" : "border-border text-muted-foreground hover:border-faint",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Node">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">ID</span>
          <span className="truncate font-mono text-xs text-faint">{selected.id}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {NODE_META[selType].output && (
            <Button variant="outline" size="sm" onClick={() => setPickerSourceId(selected.id)}>
              <Plus data-icon="inline-start" />
              Add next node
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteNodeRef.current(selected.id);
              setSelectedId(null);
            }}
          >
            <Trash2 data-icon="inline-start" />
            Delete node
          </Button>
        </div>
      </PanelSection>
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-0.5 px-5 pt-5 pb-4">
        <h2 className="text-base font-medium text-white">Workflow</h2>
        <p className="text-sm text-muted-foreground">
          <span className="num">{nodes.length}</span> {nodes.length === 1 ? "node" : "nodes"},{" "}
          <span className="num">{edges.length}</span> {edges.length === 1 ? "connection" : "connections"}. Select a
          node to edit it.
        </p>
      </div>
      <PanelSection title="Session">{sessionBlock}</PanelSection>
      <PanelSection title="Run options">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span className="flex flex-col">
            <span className="text-white">Show browser</span>
            <span className="text-xs text-faint">Open a visible window while it runs</span>
          </span>
          <Switch checked={headed} onCheckedChange={setHeaded} />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span className="flex flex-col">
            <span className="text-white">Fast mode</span>
            <span className="text-xs text-faint">Shorter waits between steps</span>
          </span>
          <Switch checked={fast} onCheckedChange={setFast} />
        </label>
      </PanelSection>
      <PanelSection title="Last run">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Status</span>
          {running ? <Badge variant="positive">Running</Badge> : <Badge variant="neutral">Idle</Badge>}
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="num text-white">{current ? `${current.i}/${current.n}` : "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Last result</span>
          <span className="font-mono text-white">{lastResult ?? "—"}</span>
        </div>
      </PanelSection>
    </div>
  );

  const lastLog = logs[logs.length - 1];

  return (
    <>
      <AppTopbar title="Automation flow" icon={Workflow}>
        <h1 className="flex min-w-0 items-center text-lg font-semibold">
          <WorkflowTitle
            name={workflowName}
            disabled={!activeWorkflowId}
            onRename={(next) => {
              if (!activeWorkflowId) return;
              renameWorkflow(activeWorkflowId, next);
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowWorkflows(true)}
            aria-label="Switch workflow"
            title="Switch workflow"
          >
            <ChevronsUpDown />
          </Button>
        </h1>
        {running ? (
          <Badge variant="positive" className="hidden lg:inline-flex">
            <Loader2 data-icon="inline-start" className="animate-spin" />
            Running{current ? <span className="num">&nbsp;{current.i}/{current.n}</span> : null}
          </Badge>
        ) : (
          <Badge variant="neutral" className="hidden lg:inline-flex">
            Idle
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
          aria-label="Save workflow"
          onClick={async () => {
            const ok = await saveNow();
            if (ok) toast.success("Workflow saved");
            else toast.error("Could not save the workflow.");
          }}
          disabled={!activeWorkflowId}
        >
          <Save data-icon="inline-start" />
          Save
        </Button>
        {running ? (
          <Button variant="outline" size="sm" onClick={onStop}>
            <Square data-icon="inline-start" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onStart}
            disabled={!hasSession}
            title={hasSession ? "Run workflow" : "Log in first"}
          >
            <Play data-icon="inline-start" />
            Run
          </Button>
        )}
      </AppTopbar>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border md:flex" aria-label="Nodes">
          <div className="flex h-12 shrink-0 items-center border-b border-border px-4 text-sm font-medium">
            Nodes
          </div>
          {paletteBody}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes}
              edges={viewEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => {
                setSelectedId(n.id);
                if (window.matchMedia("(max-width: 1023px)").matches) setShowInspector(true);
              }}
              onPaneClick={() => setSelectedId(null)}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{ stroke: "#fff", strokeWidth: 2 }}
              fitView
              fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
              colorMode="dark"
              proOptions={{ hideAttribution: true }}
              deleteKeyCode={["Backspace", "Delete"]}
              style={{ background: "transparent" }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#262626" bgColor="transparent" />
              <Controls
                showInteractive={false}
                className="!m-3 overflow-hidden !rounded-xl border border-border !shadow-none [&_button]:!border-border [&_button]:!bg-card [&_button]:!fill-white [&_button:hover]:!bg-raised"
              />
              {nodes.length > 3 && (
              <MiniMap
                pannable
                zoomable
                className="!m-3 hidden overflow-hidden !rounded-xl border border-border !bg-card !shadow-none md:block"
                bgColor="#111111"
                nodeColor="#2a2a2a"
                nodeBorderRadius={6}
                maskColor="rgba(0,0,0,0.55)"
              />
              )}
            </ReactFlow>

            <div className="absolute top-3 left-3 z-10 flex gap-2 lg:hidden">
              <Button variant="outline" size="sm" className="bg-card md:hidden" onClick={() => setShowPalette(true)}>
                <Blocks data-icon="inline-start" />
                Nodes
              </Button>
              <Button variant="outline" size="sm" className="bg-card" onClick={() => setShowInspector(true)}>
                <SlidersHorizontal data-icon="inline-start" />
                {selected ? "Node settings" : "Workflow"}
              </Button>
            </div>

            {nodes.length === 0 && activeWorkflowId && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
                <p className="max-w-xs text-center text-sm text-muted-foreground">
                  This workflow is empty. Start with a Social media trigger from Nodes.
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-background">
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              aria-expanded={showLogs}
              className="flex h-10 w-full min-w-0 items-center gap-2 px-4 text-sm hover:bg-card"
            >
              <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", !showLogs && "-rotate-180")} />
              <span className="font-medium">Logs</span>
              <span className="num text-xs text-faint">{logs.length}</span>
              {!showLogs && lastLog && (
                <span className="ml-auto min-w-0 truncate font-mono text-xs text-faint">{lastLog.message}</span>
              )}
            </button>
            {showLogs && (
              <div
                ref={logsRef}
                className={cn(
                  "overflow-y-auto bg-black px-4 pb-3 font-mono text-xs leading-relaxed",
                  logs.length > 0 && "h-40 md:h-52",
                )}
              >
                {logs.length === 0 ? (
                  <p className="pt-1 font-sans text-sm text-muted-foreground">
                    No log lines yet. Each step of a run shows up here.
                  </p>
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
                      {l.target && <span className="text-faint">→ {l.target} </span>}
                      <span>{l.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="hidden w-80 shrink-0 flex-col border-l border-border lg:flex" aria-label="Inspector">
          <div className="flex h-12 shrink-0 items-center border-b border-border px-5 text-sm font-medium">
            {selected ? "Node settings" : "Workflow settings"}
          </div>
          {inspectorBody}
        </aside>
      </div>

      <Sheet open={showPalette} onOpenChange={setShowPalette}>
        <SheetContent side="left" className="gap-0 p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Nodes</SheetTitle>
            <SheetDescription>Tap a node to add it to the canvas.</SheetDescription>
          </SheetHeader>
          {paletteBody}
        </SheetContent>
      </Sheet>

      <Sheet open={showInspector} onOpenChange={setShowInspector}>
        <SheetContent side="right" className="gap-0 p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{selected ? "Node settings" : "Workflow settings"}</SheetTitle>
            <SheetDescription>
              {selected ? "Changes save automatically." : "Session, run options and the last run."}
            </SheetDescription>
          </SheetHeader>
          {inspectorBody}
        </SheetContent>
      </Sheet>

      <Sheet open={showWorkflows} onOpenChange={setShowWorkflows}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Workflows</SheetTitle>
            <SheetDescription>Switch, rename or create a workflow.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-col gap-3 px-4 pb-4">
            <Button variant="outline" onClick={createWorkflow} className="self-start">
              <Plus data-icon="inline-start" />
              New workflow
            </Button>
            <div className="flex min-h-0 flex-col overflow-y-auto">
              {workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workflows yet.</p>
              ) : (
                workflows.map((w) => {
                  const on = w.id === activeWorkflowId;
                  return (
                    <div
                      key={w.id}
                      className={cn(
                        "group flex items-center gap-1 rounded-xl px-2 py-1 text-sm transition-colors",
                        on ? "bg-raised" : "hover:bg-card",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (w.id !== activeWorkflowId) {
                            loadedWorkflowRef.current = null;
                            setActiveWorkflowId(w.id);
                          }
                          setShowWorkflows(false);
                        }}
                        onDoubleClick={() => {
                          const next = window.prompt("Rename workflow", w.name);
                          if (next && next.trim() && next !== w.name) {
                            renameWorkflow(w.id, next.trim());
                          }
                        }}
                        className="min-w-0 flex-1 truncate py-1 text-left"
                        title="Click to load, double-click to rename"
                      >
                        {w.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget({ id: w.id, name: w.name })}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        title="Delete"
                        aria-label="Delete workflow"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" will be permanently removed. This can't be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteWorkflow(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet
        open={pickerSourceId !== null}
        onOpenChange={(v) => !v && setPickerSourceId(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add next node</SheetTitle>
            <SheetDescription>
              {pickerSource?.type
                ? `Choose what comes after ${NODE_META[pickerSource.type as NodeKey]?.label ?? pickerSource.type}.`
                : "Pick a node."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-2 pb-4">
            {pickerOptions.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">No further nodes can follow this one.</p>
            ) : (
              pickerOptions.map((k) => {
                const m = NODE_META[k];
                const Icon = m.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => addNodeFromPicker(k)}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-raised"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-white">{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.description}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
