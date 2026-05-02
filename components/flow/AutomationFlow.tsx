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
  Smile,
  Play,
  Square,
  Eye,
  EyeOff,
  Zap,
  ZapOff,
  Share2,
  Check,
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
import { Plus } from "lucide-react";

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

const REACTION_OPTIONS: Array<{ id: ReactionKind; label: string; emoji: string }> = [
  { id: "like", label: "Like", emoji: "👍" },
  { id: "love", label: "Love", emoji: "❤️" },
  { id: "haha", label: "Haha", emoji: "😆" },
  { id: "wow", label: "Wow", emoji: "😮" },
  { id: "sad", label: "Sad", emoji: "😢" },
  { id: "angry", label: "Angry", emoji: "😡" },
];

type Platform = "facebook" | "instagram" | "threads";

/* ---------- icon node shell ---------- */

function IconNode({
  icon: Icon,
  label,
  active,
  running,
  iconClassName,
  onOpen,
  onDelete,
  showLeft = true,
  showRight = true,
  renderIcon,
  onAdd,
}: {
  icon?: LucideIcon;
  label: string;
  active?: boolean;
  running?: boolean;
  iconClassName?: string;
  onOpen: () => void;
  onDelete?: () => void;
  showLeft?: boolean;
  showRight?: boolean;
  renderIcon?: () => React.ReactNode;
  onAdd?: () => void;
}) {
  const greenBorder = active || running;
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
        className={`flex size-22 cursor-pointer items-center justify-center rounded-2xl border bg-card shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${greenBorder
            ? `border-emerald-500 ${active ? "ring-2 ring-emerald-500/30" : ""}`
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
      {showRight && onAdd && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="absolute z-10 flex size-5 items-center justify-center rounded-full border border-zinc-600 bg-card text-muted-foreground opacity-0 transition-opacity hover:border-emerald-500 hover:text-emerald-500 group-hover:opacity-100"
          style={{ left: "100%", top: "60%", transform: "translateX(-50%) translateY(-50%)" }}
          title="Add next node"
          aria-label="Add next node"
        >
          <Plus className="size-3" />
        </button>
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
    onAdd: () => void;
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
        running={d.state.status?.running ?? false}
        label="Social Media"
        renderIcon={() => <FacebookIcon className="size-9 text-[#1877F2]" />}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
        onAdd={d.onAdd}
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
                className={`relative flex flex-col items-center gap-2 rounded-md border p-3 text-xs transition-colors ${selected
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
    onAdd: () => void;
  };
  const [open, setOpen] = useState(false);
  const has = d.state.status?.hasSession;
  return (
    <>
      <IconNode
        running={d.state.status?.running ?? false}
        icon={KeyRound}
        iconClassName="text-amber-500"
        label="Session"
        active={d.state.active === "session"}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
        onAdd={d.onAdd}
      />
      <NodeDialog
        open={open}
        onOpenChange={setOpen}
        title="Session"
        description="Login + saved cookies for the target platform."
      >
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          {has ? <>
            <Check className="inline w-4 h-4 mr-1" />
            Saved Facebook session
          </> : "No session yet"}
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
    onAdd: () => void;
  };
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconNode
        running={d.state.status?.running ?? false}
        icon={TargetIcon}
        iconClassName="text-rose-500"
        label="Target Page"
        active={d.state.active === "target"}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
        onAdd={d.onAdd}
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
        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>Save</Button>
        </div>
      </NodeDialog>
    </>
  );
}

function TargetPostNode({ id, data }: NodeProps) {
  const d = data as {
    state: RunState;
    url: string;
    onPostUrlChange: (id: string, v: string) => void;
    onDelete: (id: string) => void;
    onAdd: () => void;
  };
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconNode
        running={d.state.status?.running ?? false}
        icon={TargetIcon}
        iconClassName="text-fuchsia-500"
        label="Target Post"
        active={d.state.active === "targetPost"}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
        onAdd={d.onAdd}
      />
      <NodeDialog
        open={open}
        onOpenChange={setOpen}
        title="Target Post"
        description="The post that will receive reactions."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`target-post-url-${id}`} className="text-xs">
            Post URL
          </Label>
          <Input
            id={`target-post-url-${id}`}
            placeholder="https://www.facebook.com/.../posts/123..."
            value={d.url ?? ""}
            onChange={(e) => d.onPostUrlChange(id, e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>Save</Button>
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
        running={d.state.status?.running ?? false}
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

function ReactionsNode({ id, data }: NodeProps) {
  const d = data as {
    state: RunState;
    reaction: ReactionKind;
    onReactionChange: (id: string, r: ReactionKind) => void;
    onDelete: (id: string) => void;
  };
  const [open, setOpen] = useState(false);
  const current = REACTION_OPTIONS.find((r) => r.id === d.reaction) ?? REACTION_OPTIONS[0];
  return (
    <>
      <IconNode
        running={d.state.status?.running ?? false}
        icon={Smile}
        iconClassName="text-yellow-500"
        label={`Reactions: ${current.label}`}
        showRight={false}
        active={d.state.active === "reactions"}
        onOpen={() => setOpen(true)}
        onDelete={() => d.onDelete(id)}
      />
      <NodeDialog
        open={open}
        onOpenChange={setOpen}
        title="Reactions"
        description="Drops the chosen reaction on the target post."
      >
        <div className="grid grid-cols-3 gap-2">
          {REACTION_OPTIONS.map((r) => {
            const selected = r.id === d.reaction;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => d.onReactionChange(id, r.id)}
                className={`flex flex-col items-center gap-1 rounded-md border p-3 text-xs transition-colors ${
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                    : "border-border hover:border-foreground/40"
                }`}
              >
                <span className="text-2xl leading-none">{r.emoji}</span>
                <span className="font-medium">{r.label}</span>
              </button>
            );
          })}
        </div>
      </NodeDialog>
    </>
  );
}

const nodeTypes = {
  social: SocialMediaNode,
  session: SessionNode,
  target: TargetNode,
  targetPost: TargetPostNode,
  action: ActionNode,
  reactions: ReactionsNode,
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
    { type: "targetPost", label: "Target Post", description: "Post URL for reactions", icon: TargetIcon },
    { type: "action", label: "Follow / Like", description: "Try Follow, fall back to Like", icon: Heart },
    { type: "reactions", label: "Reactions", description: "Drop a reaction on the target", icon: Smile },
  ];

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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="w-64 rounded-md border border-border bg-background px-2 py-1 text-xl font-semibold tracking-tight outline-none focus:border-foreground/40"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      className="rounded-md px-2 py-1 -mx-2 text-xl font-semibold tracking-tight hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
      title={disabled ? undefined : "Click to rename"}
    >
      {name}
    </button>
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
        // Reactions live on the reactions node, but posts on targetPost. Pair
        // them by walking edges: targetPost → reactions. Each reactions node
        // applies its kind to whichever Target Post(s) feed into it.
        // Simpler model for now: store reaction on reactions node, apply the
        // first reactions-node's kind to all post URLs at sync time. Since
        // we don't have edge access here, we fall back to reading reaction
        // from the changed node and applying to every target post.
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

  const dataFor = useCallback(
    (id: string): Record<string, unknown> => {
      const onDelete = (nodeId: string) => deleteNodeRef.current(nodeId);
      const onAdd = () => addPickerRef.current(id);
      const type = id.split("-")[0];
      switch (type) {
        case "social":
          return { state, onPlatformChange, onDelete, onAdd };
        case "session":
          return { state, onLogin, onDelete, onAdd };
        case "target":
          return { state, onUrlChange: onTargetUrlChange, onDelete, onAdd };
        case "targetPost":
          return { state, onPostUrlChange, onDelete, onAdd };
        case "reactions":
          return { state, onReactionChange, onDelete, onAdd };
        default:
          return { state, onDelete, onAdd };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state,
      headed,
      fast,
      onLogin,
      onStart,
      onStop,
      onTargetUrlChange,
      onPlatformChange,
      onPostUrlChange,
      onReactionChange,
    ],
  );

  useEffect(() => {
    addPickerRef.current = (sourceId) => setPickerSourceId(sourceId);
  }, []);

  const initialNodes = useMemo<Node[]>(() => [], []);

  const initialEdges = useMemo<Edge[]>(
    () => [],
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

  useEffect(() => {
    const running = !!status?.running;
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        animated: running,
        style: { ...(e.style ?? {}), stroke: running ? "#10b981" : undefined },
      })),
    );
  }, [status?.running, setEdges]);

  const refreshWorkflows = useCallback(async () => {
    const r = await fetch("/api/workflows", { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { items: Array<{ id: string; name: string; updatedAt: number }> };
    setWorkflows(j.items);
    return j.items;
  }, []);

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
  }, [refreshWorkflows]);

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
      setNodes(
        nodesIn.map((n) => ({ ...n, data: { ...n.data, ...dataFor(n.id) } })),
      );
      setEdges(edgesIn);

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
  }, [activeWorkflowId, setNodes, setEdges, dataFor, qs]);

  // Autosave nodes/edges (debounced) for the active workflow.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeWorkflowId || loadedWorkflowRef.current !== activeWorkflowId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      // Strip non-serializable function fields from data.
      const cleanNodes = nodes.map((n) => {
        const d = (n.data ?? {}) as Record<string, unknown>;
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(d)) {
          if (typeof v !== "function" && k !== "state") data[k] = v;
        }
        return { ...n, data };
      });
      await fetch(`/api/workflows/${activeWorkflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { nodes: cleanNodes, edges } }),
      });
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, activeWorkflowId]);

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
    return PALETTE.filter((p) => allowed.includes(p.type));
  }, [pickerSource, ALLOWED_CONNECTIONS]);

  const addNodeFromPicker = useCallback(
    (type: NodeKey) => {
      if (!pickerSource) return;
      const id = `${type}-${Date.now().toString(36)}`;
      const baseData = dataFor(id);
      const data =
        type === "target"
          ? { ...baseData, url: "" }
          : type === "targetPost"
            ? { ...baseData, url: "" }
            : type === "reactions"
              ? { ...baseData, reaction: "like" as ReactionKind }
              : type === "social"
                ? { ...baseData, platform: "facebook" as Platform }
                : baseData;
      const newNode: Node = {
        id,
        type,
        position: {
          x: pickerSource.position.x + 200,
          y: pickerSource.position.y,
        },
        data,
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) =>
        addEdge(
          {
            id: `e-${pickerSource.id}-${id}`,
            source: pickerSource.id,
            target: id,
            animated: !!status?.running,
          },
          eds,
        ),
      );
      setPickerSourceId(null);
    },
    [pickerSource, dataFor, setNodes, setEdges, status?.running],
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
        <div className="flex items-center gap-3">
          <WorkflowTitle
            name={
              workflows.find((w) => w.id === activeWorkflowId)?.name ??
              "Automation Flow"
            }
            disabled={!activeWorkflowId}
            onRename={(next) => {
              if (!activeWorkflowId) return;
              renameWorkflow(activeWorkflowId, next);
            }}
          />
          <button
            type="button"
            onClick={() => setShowWorkflows(true)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Add new workflow
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showLogs ? "Hide logs" : "Show logs"}
          </button>
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${status?.running ? "bg-emerald-500" : "bg-zinc-400"
              }`}
          />
          {status?.running ? "Running" : "Idle"}
        </div>
      </header>

      <Sheet open={showWorkflows} onOpenChange={setShowWorkflows}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Workflows</SheetTitle>
            <SheetDescription>Switch, rename, or create a workflow.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-col gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={createWorkflow}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-left text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              + New workflow
            </button>
            <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
              {workflows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No workflows yet.</p>
              ) : (
                workflows.map((w) => {
                  const selected = w.id === activeWorkflowId;
                  return (
                    <div
                      key={w.id}
                      className={`group flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${selected
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border hover:border-foreground/40"
                        }`}
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
                        className="min-w-0 flex-1 truncate text-left"
                        title="Click to load — double-click to rename"
                      >
                        {w.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: w.id, name: w.name })}
                        className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                        title="Delete"
                        aria-label="Delete workflow"
                      >
                        ✕
                      </button>
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

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${showLogs ? "lg:grid-cols-[1fr_360px]" : ""}`}
      >

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

        {showLogs && (
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
        )}
      </div>

      <Sheet
        open={pickerSourceId !== null}
        onOpenChange={(v) => !v && setPickerSourceId(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add next node</SheetTitle>
            <SheetDescription>
              {pickerSource
                ? `Choose what comes after ${pickerSource.type}.`
                : "Pick a node."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-4">
            {pickerOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No further nodes can follow this one.
              </p>
            ) : (
              pickerOptions.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => addNodeFromPicker(p.type)}
                    className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-foreground/40"
                  >
                    <Icon className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
