"use client";

import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Repeat2,
  Plus,
  Trash2,
  Send,
  Eye,
  EyeOff,
  CircleCheck,
  Pencil,
  Link as LinkIcon,
  Unplug,
  Square,
  Download,
  RefreshCcw,
  Sparkles,
  Brain,
  Check,
  ChevronsUpDown,
  Loader2,
  MessageSquarePlus,
  ListVideo,
  Settings2,
  FileSearch,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { RepostPipeline, type PipelineStage, type StageStatus } from "@/components/dashboard/RepostPipeline";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/icons/brand";

type ConfigField = { set: boolean; value: string | null; masked: string | null };
type PlainField = { set: boolean; value: string | null };

type SharedConfigMasked = {
  youtubeApiKey: ConfigField;
  openrouterApiKey: ConfigField;
  openrouterModel: PlainField;
};

type Flow = "yt-to-fb" | "ig-to-yt" | "tt-to-fb";

type YoutubeOauth =
  | { connected: false }
  | {
      connected: true;
      channelId: string | null;
      channelTitle: string | null;
      connectedAt: string;
    };

type AccountConfigMasked = {
  fbPageAccessToken: ConfigField;
  defaultPageId: PlainField;
  flow?: Flow;
  youtube?: YoutubeOauth;
};

type RepostingAccount = {
  id: string;
  name: string;
  flow: Flow;
  createdAt: string;
};

const FLOW_LABELS: Record<Flow, string> = {
  "yt-to-fb": "YouTube → Facebook",
  "ig-to-yt": "Instagram → YouTube",
  "tt-to-fb": "TikTok → Facebook",
};

function FlowBadge({ flow, size = 14 }: { flow: Flow; size?: number }) {
  if (flow === "yt-to-fb") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <YoutubeIcon size={size} className="text-[#ff0000]" />
        <span className="text-xs">→</span>
        <FacebookIcon size={size} className="text-[#1877f2]" />
      </span>
    );
  }
  if (flow === "tt-to-fb") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <TiktokIcon size={size} />
        <span className="text-xs">→</span>
        <FacebookIcon size={size} className="text-[#1877f2]" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <InstagramIcon size={size} className="text-[#e4405f]" />
      <span className="text-xs">→</span>
      <YoutubeIcon size={size} className="text-[#ff0000]" />
    </span>
  );
}

type QueueItem = {
  url: string;
  scheduledAt: string;
  publishNow: boolean;
  caption?: string;
  comment?: string;
};

type ScheduledRecord = {
  createdAt: string;
  scheduledAt: string;
  url: string;
  videoId: string;
  pageId: string;
  fbPostId: string;
  caption: string;
  status: string;
  publishedAt?: string;
  deletedAt?: string;
  error?: string;
};

type SafetyRiskLevel = "safe" | "review" | "block";
type PreflightApprovalStatus = "pending" | "approved" | "blocked" | "overridden";

type CaptionVariant = {
  id: string;
  text: string;
  hookType: string;
  rationale: string;
};

type SafetyAssessment = {
  riskLevel: SafetyRiskLevel;
  categories: string[];
  reasons: string[];
  suggestedRewrite: string;
};

type PreflightItemState = {
  url: string;
  videoId: string;
  title: string;
  variants: CaptionVariant[];
  safetyByVariant: Record<string, SafetyAssessment>;
  selectedVariantId: string | null;
  approvalStatus: PreflightApprovalStatus;
  overrideReason: string | null;
  reviewedAt: string | null;
  generatedAt: string;
  blockReasons: string[];
};

type CoachReport = {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  metrics: {
    total: number;
    posted: number;
    scheduled: number;
    failed: number;
    deleted: number;
    avgCaptionLength: number;
    avgHashtags: number;
    topChannels: Array<{ channel: string; count: number }>;
    timeBuckets: Array<{ bucket: string; count: number }>;
  };
  findings: string[];
  recommendations: string[];
  playbook: string[];
  insufficientData?: boolean;
};

function defaultScheduledAt(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  d.setSeconds(0, 0);
  return formatDateTimeLocal(d);
}

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextDayFrom(scheduledAt: string): string | null {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 1);
  d.setSeconds(0, 0);
  return formatDateTimeLocal(d);
}

function canonicalYoutubeUrl(input: string): string {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }
  try {
    const u = new URL(trimmed);
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) {
      return `https://www.youtube.com/watch?v=${v}`;
    }
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
        return `https://www.youtube.com/watch?v=${id}`;
      }
    }
  } catch {
    // keep as-is
  }
  return trimmed;
}

const blankRow = (offset = 20): QueueItem => ({
  url: "",
  scheduledAt: defaultScheduledAt(offset),
  publishNow: false,
});

const FLOW_SOURCE: Record<
  Flow,
  { noun: string; placeholder: string; icon: React.ReactNode; destination: string }
> = {
  "yt-to-fb": {
    noun: "YouTube Short",
    placeholder: "https://www.youtube.com/shorts/…",
    icon: <YoutubeIcon size={16} className="text-[#ff0000]" />,
    destination: "Facebook Page",
  },
  "tt-to-fb": {
    noun: "TikTok video",
    placeholder: "https://www.tiktok.com/@user/video/…",
    icon: <TiktokIcon size={16} />,
    destination: "Facebook Page",
  },
  "ig-to-yt": {
    noun: "Instagram Reel",
    placeholder: "https://www.instagram.com/reel/…",
    icon: <InstagramIcon size={16} className="text-[#e4405f]" />,
    destination: "YouTube channel",
  },
};

const STATUS_BADGE: Record<string, { variant: "positive" | "warning" | "negative" | "neutral"; label: string }> = {
  posted: { variant: "positive", label: "Posted" },
  scheduled: { variant: "neutral", label: "Scheduled" },
  failed: { variant: "negative", label: "Failed" },
  deleted: { variant: "negative", label: "Deleted" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { variant: "neutral" as const, label: status };
  return (
    <Badge variant={s.variant} className="capitalize">
      {s.label}
    </Badge>
  );
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function youtubeThumb(url: string): string | null {
  const m = canonicalYoutubeUrl(url).match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function SecretField({
  id,
  label,
  value,
  onChange,
  placeholder,
  isSet,
  onClear,
  clearLabel = "Clear",
  disabled,
  secret = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isSet?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  disabled?: boolean;
  secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {isSet && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-white"
          >
            {clearLabel}
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={secret && !show ? "password" : "text"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={secret ? "pr-10" : undefined}
          autoComplete="off"
        />
        {secret && (
          <button
            type="button"
            className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-white"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? `Hide ${label}` : `Show ${label}`}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-border py-8 first:pt-2 last:border-b-0 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-1.5 lg:pt-2">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-5 rounded-2xl bg-card p-5">{children}</div>
    </section>
  );
}

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <h2 className="text-base font-medium">{children}</h2>
      {action}
    </div>
  );
}

export function RepostingPanel() {
  // accounts
  const [accounts, setAccounts] = useState<RepostingAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // shared config
  const [sharedConfig, setSharedConfig] = useState<SharedConfigMasked | null>(null);
  const [savingShared, setSavingShared] = useState(false);
  const [youtubeKeyDraft, setYoutubeKeyDraft] = useState("");
  const [openrouterKeyDraft, setOpenrouterKeyDraft] = useState("");
  const [openrouterModelDraft, setOpenrouterModelDraft] = useState("");

  // per-account config
  const [accountConfig, setAccountConfig] = useState<AccountConfigMasked | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [pageId, setPageId] = useState("");
  const [fbTokenDraft, setFbTokenDraft] = useState("");

  // dialogs
  const [nameDialog, setNameDialog] = useState<
    | { mode: "create"; value: string; flow: Flow }
    | { mode: "rename"; value: string; id: string }
    | null
  >(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "history" | "coach" | "settings">("queue");
  const [pasteDraft, setPasteDraft] = useState("");
  const [channelPick, setChannelPick] = useState<{
    channel: string;
    shorts: Array<{ id: string; url: string; title: string }>;
    selected: Set<string>;
  } | null>(null);
  const [listingChannel, setListingChannel] = useState(false);
  const [channelLimit, setChannelLimit] = useState<number | null>(20);
  // Clock for "upcoming" and the 7-day strip; ticks each minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // queue & run
  const [items, setItems] = useState<QueueItem[]>([blankRow()]);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingRow, setDownloadingRow] = useState<number | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const [log, setLog] = useState<string[]>([]);
  // Per queue position (1-based idx from the stream): last step seen and the stage it failed in.
  const [runSteps, setRunSteps] = useState<Record<number, { step: string; at: string }>>({});
  const [history, setHistory] = useState<ScheduledRecord[]>([]);
  const [preflightItems, setPreflightItems] = useState<Record<string, PreflightItemState>>({});
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [approvingPreflight, setApprovingPreflight] = useState<string | null>(null);
  const [coachReport, setCoachReport] = useState<CoachReport | null>(null);
  const [runningCoach, setRunningCoach] = useState(false);

  const append = (line: string) => setLog((l) => [...l, line]);

  // ---- accounts ----
  const refreshAccounts = async (preferId?: string) => {
    try {
      const res = await fetch("/api/reposting/accounts");
      if (!res.ok) return;
      const data = (await res.json()) as { accounts: RepostingAccount[] };
      setAccounts(data.accounts);
      if (data.accounts.length === 0) {
        setActiveId(null);
      } else if (preferId && data.accounts.some((a) => a.id === preferId)) {
        setActiveId(preferId);
      } else if (!activeId || !data.accounts.some((a) => a.id === activeId)) {
        const stored = localStorage.getItem("reposting:activeId");
        const pick =
          stored && data.accounts.some((a) => a.id === stored) ? stored : data.accounts[0].id;
        setActiveId(pick);
      }
    } catch {
      // ignore
    }
  };

  const openCreateDialog = () => {
    setNameDialog({
      mode: "create",
      value: `Account ${accounts.length + 1}`,
      flow: "yt-to-fb",
    });
  };

  const openRenameDialog = () => {
    if (!activeId) return;
    const current = accounts.find((a) => a.id === activeId);
    setNameDialog({ mode: "rename", value: current?.name ?? "", id: activeId });
  };

  const submitNameDialog = async () => {
    if (!nameDialog) return;
    const name = nameDialog.value.trim();
    if (!name) return;
    try {
      if (nameDialog.mode === "create") {
        const res = await fetch("/api/reposting/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, flow: nameDialog.flow }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = (await res.json()) as RepostingAccount;
        await refreshAccounts(created.id);
        toast.success(`Created "${created.name}"`);
      } else {
        const res = await fetch("/api/reposting/accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: nameDialog.id, name }),
        });
        if (!res.ok) throw new Error(await res.text());
        await refreshAccounts(nameDialog.id);
      }
      setNameDialog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operation failed");
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deleteDialogId) return;
    try {
      const res = await fetch(
        `/api/reposting/accounts?id=${encodeURIComponent(deleteDialogId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success("Deleted");
      setDeleteDialogId(null);
      await refreshAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  // ---- shared config ----
  const refreshShared = async () => {
    try {
      const res = await fetch("/api/reposting/shared-config");
      if (!res.ok) return;
      const data = (await res.json()) as SharedConfigMasked;
      setSharedConfig(data);
      setYoutubeKeyDraft(data.youtubeApiKey.value ?? "");
      setOpenrouterKeyDraft(data.openrouterApiKey.value ?? "");
      setOpenrouterModelDraft(data.openrouterModel.value ?? "");
    } catch {
      // ignore
    }
  };

  const saveShared = async () => {
    setSavingShared(true);
    try {
      const body: Record<string, string> = {};
      const ytCurrent = sharedConfig?.youtubeApiKey.value ?? "";
      const orCurrent = sharedConfig?.openrouterApiKey.value ?? "";
      const modelCurrent = sharedConfig?.openrouterModel.value ?? "";
      if (youtubeKeyDraft !== ytCurrent) body.youtubeApiKey = youtubeKeyDraft;
      if (openrouterKeyDraft !== orCurrent) body.openrouterApiKey = openrouterKeyDraft;
      if (openrouterModelDraft !== modelCurrent) body.openrouterModel = openrouterModelDraft;
      if (Object.keys(body).length === 0) {
        toast.info("Nothing changed");
        return;
      }
      const res = await fetch("/api/reposting/shared-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as SharedConfigMasked;
      setSharedConfig(data);
      setYoutubeKeyDraft(data.youtubeApiKey.value ?? "");
      setOpenrouterKeyDraft(data.openrouterApiKey.value ?? "");
      setOpenrouterModelDraft(data.openrouterModel.value ?? "");
      toast.success("Shared settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingShared(false);
    }
  };

  const clearSharedKey = async (
    field: "youtubeApiKey" | "openrouterApiKey" | "openrouterModel",
  ) => {
    try {
      const res = await fetch("/api/reposting/shared-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as SharedConfigMasked;
      setSharedConfig(data);
      if (field === "youtubeApiKey") setYoutubeKeyDraft("");
      if (field === "openrouterApiKey") setOpenrouterKeyDraft("");
      if (field === "openrouterModel") setOpenrouterModelDraft("");
      toast.success("Cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    }
  };

  // ---- account config + history ----
  const refreshAccountConfig = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/config`);
      if (!res.ok) return;
      const data = (await res.json()) as AccountConfigMasked;
      setAccountConfig(data);
      setFbTokenDraft(data.fbPageAccessToken.value ?? "");
      setPageId(data.defaultPageId.value ?? "");
    } catch {
      // ignore
    }
  };

  const refreshHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/schedule`);
      if (!res.ok) return;
      const data = (await res.json()) as { records: ScheduledRecord[] };
      setHistory([...data.records].reverse());
    } catch {
      // ignore
    }
  };

  const pollPublishStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/schedule/refresh`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { records: ScheduledRecord[] };
      setHistory([...data.records].reverse());
    } catch {
      // ignore
    }
  };

  const saveAccountConfig = async () => {
    if (!activeId) return;
    setSavingAccount(true);
    try {
      const body: Record<string, string> = {};
      const fbCurrent = accountConfig?.fbPageAccessToken.value ?? "";
      const pageCurrent = accountConfig?.defaultPageId.value ?? "";
      if (fbTokenDraft !== fbCurrent) body.fbPageAccessToken = fbTokenDraft;
      if (pageId !== pageCurrent) body.defaultPageId = pageId;
      if (Object.keys(body).length === 0) {
        toast.info("Nothing changed");
        return;
      }
      const res = await fetch(`/api/reposting/accounts/${activeId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AccountConfigMasked;
      setAccountConfig(data);
      setFbTokenDraft(data.fbPageAccessToken.value ?? "");
      setPageId(data.defaultPageId.value ?? pageId);
      toast.success("Account settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingAccount(false);
    }
  };

  const disconnectYoutube = async () => {
    if (!activeId) return;
    try {
      const res = await fetch("/api/reposting/oauth/youtube/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeId }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Disconnected");
      await refreshAccountConfig(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disconnect failed");
    }
  };

  const clearAccountKey = async (field: "fbPageAccessToken" | "defaultPageId") => {
    if (!activeId) return;
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AccountConfigMasked;
      setAccountConfig(data);
      if (field === "fbPageAccessToken") setFbTokenDraft("");
      if (field === "defaultPageId") setPageId("");
      toast.success("Cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    }
  };

  const refreshPreflight = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/ai/preflight`);
      if (!res.ok) {
        setPreflightItems({});
        return;
      }
      const data = (await res.json()) as { items: PreflightItemState[] };
      const next: Record<string, PreflightItemState> = {};
      for (const item of data.items ?? []) {
        next[canonicalYoutubeUrl(item.url)] = item;
      }
      setPreflightItems(next);
    } catch {
      // ignore
    }
  };

  const refreshCoach = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/ai/coach`);
      if (!res.ok) {
        setCoachReport(null);
        return;
      }
      const data = (await res.json()) as { report: CoachReport | null };
      setCoachReport(data.report ?? null);
    } catch {
      // ignore
    }
  };

  const runPreflight = async () => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    const queue = items
      .filter((it) => it.url.trim().length > 0)
      .map((it) => ({
        url: canonicalYoutubeUrl(it.url),
        caption: it.caption,
        comment: it.comment,
      }));
    if (queue.length === 0) {
      toast.error("Add at least one YouTube URL first");
      return;
    }
    setRunningPreflight(true);
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/ai/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: queue }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: PreflightItemState[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Preflight failed (${res.status})`);
      const next: Record<string, PreflightItemState> = {};
      for (const item of data.items ?? []) {
        next[canonicalYoutubeUrl(item.url)] = item;
      }
      setPreflightItems(next);
      toast.success(`AI preflight completed for ${Object.keys(next).length} URL(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preflight failed");
    } finally {
      setRunningPreflight(false);
    }
  };

  const approvePreflight = async (args: {
    url: string;
    variantId: string;
  }) => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    setApprovingPreflight(args.url);
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/ai/preflight/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: PreflightItemState;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Approve failed (${res.status})`);
      if (data.item) {
        const key = canonicalYoutubeUrl(data.item.url);
        setPreflightItems((prev) => ({ ...prev, [key]: data.item as PreflightItemState }));
      }
      toast.success("Preflight approval saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApprovingPreflight(null);
    }
  };

  const refreshCoachNow = async () => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    setRunningCoach(true);
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/ai/coach`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        report?: CoachReport;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Coach refresh failed (${res.status})`);
      setCoachReport(data.report ?? null);
      toast.success("Weekly AI coach refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Coach refresh failed");
    } finally {
      setRunningCoach(false);
    }
  };

  // ---- queue ops ----
  const updateItem = (i: number, patch: Partial<QueueItem>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const addRow = () =>
    setItems((arr) => {
      const last = arr.at(-1);
      const scheduledAt = last ? nextDayFrom(last.scheduledAt) : null;
      return [
        ...arr,
        {
          ...blankRow(),
          scheduledAt: scheduledAt ?? defaultScheduledAt(20),
          publishNow: false,
        },
      ];
    });
  const removeRow = (i: number) =>
    setItems((arr) => {
      const next = arr.filter((_, idx) => idx !== i);
      return next.length === 0 ? [blankRow()] : next;
    });

  const run = async () => {
    if (!activeId || !activeAccount) {
      toast.error("Select or create a reposting account first");
      return;
    }
    const needsFbPage =
      activeAccount.flow === "yt-to-fb" || activeAccount.flow === "tt-to-fb";
    if (needsFbPage && !pageId.trim()) {
      toast.error("Enter a Facebook Page ID");
      return;
    }
    if (activeAccount.flow === "ig-to-yt" && !accountConfig?.youtube?.connected) {
      toast.error("Connect a YouTube account first");
      return;
    }
    const validRows = items
      .map((it, index) => ({ item: it, index }))
      .filter(({ item }) => item.url.trim().length > 0);
    const submittedIndices = validRows.map(({ index }) => index);
    let valid = validRows.map(({ item }) => item);
    if (valid.length === 0) {
      toast.error(
        activeAccount.flow === "yt-to-fb"               
          ? "Add at least one YouTube URL"
          : activeAccount.flow === "ig-to-yt"
            ? "Add at least one Instagram Reel URL"
            : "Add at least one TikTok URL",
      );
      return;
    }

    if (activeAccount.flow === "yt-to-fb") {
      const missing: string[] = [];
      const blocked: string[] = [];
      const nextValid = valid.map((item) => {
        const key = canonicalYoutubeUrl(item.url);
        const pf = preflightItems[key];
        if (!pf) {
          missing.push(key);
          return item;
        }
        if (!pf.selectedVariantId) {
          blocked.push(key);
          return item;
        }
        const chosen = pf.variants.find((v) => v.id === pf.selectedVariantId);
        if (!chosen?.text.trim()) {
          blocked.push(key);
          return item;
        }
        return { ...item, url: key, caption: chosen.text.trim() };
      });

      if (missing.length > 0) {
        toast.error("AI preflight missing for one or more URLs. Run AI preflight first.");
        return;
      }
      if (blocked.length > 0) {
        toast.error("Choose a caption for each URL before scheduling.");
        return;
      }
      valid = nextValid;
    }

    setLog([]);
    setRunSteps({});
    setRunning(true);
    append(`Submitting ${valid.length} item(s)…`);

    const ac = new AbortController();
    runAbortRef.current = ac;

    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, items: valid }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Request failed: ${res.status} ${txt}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const completed = new Set<number>();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as {
              idx: number;
              url: string;
              step: string;
              message: string;
              caption?: string;
              fbPostId?: string;
            };
            if (Number.isInteger(evt.idx) && evt.idx >= 1) {
              setRunSteps((prev) => ({
                ...prev,
                [evt.idx]: {
                  step: evt.step,
                  at: evt.step === "error" ? (prev[evt.idx]?.at ?? "metadata") : evt.step,
                },
              }));
            }
            if (evt.step === "done" && Number.isInteger(evt.idx) && evt.idx >= 1) {
              completed.add(evt.idx - 1);
            }
            const tag = `[${evt.idx}] ${evt.step}`;
            append(`${tag}: ${evt.message}`);
            if (evt.caption && evt.step === "done") {
              append(`    caption: ${evt.caption}`);
            }
          } catch {
            append(line);
          }
        }
      }
      if (ac.signal.aborted) {
        append("Stopped.");
        toast.info("Run stopped");
      } else {
        const remainingSubmitted = submittedIndices
          .filter((_, submittedOrder) => !completed.has(submittedOrder))
          .map((sourceIndex) => items[sourceIndex]);
        const unsentDrafts = items.filter((it) => it.url.trim().length === 0);
        const remaining = [...remainingSubmitted, ...unsentDrafts];
        if (remaining.length > 0) {
          setItems(remaining);
          append(
            `Queue updated: archived ${completed.size} success(es), kept ${remainingSubmitted.length} failed item(s) for retry.`,
          );
        } else {
          setItems([blankRow()]);
          append(`Queue updated: archived ${completed.size} success(es), queue is now empty.`);
        }
        toast.success("Pipeline finished");
      }
      await refreshHistory(activeId);
    } catch (e) {
      if (ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        append("Stopped.");
        toast.info("Run stopped");
      } else {
        const msg = e instanceof Error ? e.message : "Unknown error";
        append(`Error: ${msg}`);
        toast.error(msg);
      }
    } finally {
      runAbortRef.current = null;
      setRunning(false);
    }
  };

  const stopRun = () => {
    runAbortRef.current?.abort();
  };

  const triggerBrowserDownload = (blob: Blob, fallbackName: string, fromHeader: string | null) => {
    const match = fromHeader?.match(/filename="?([^";]+)"?/i);
    const fileName = (match?.[1] ?? fallbackName).trim();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const downloadOne = async (item: QueueItem, idx: number, total?: number) => {
    if (!activeId) throw new Error("No active account selected");
    const trimmed = item.url.trim();
    if (!trimmed) throw new Error("URL is empty");
    setDownloadingRow(idx);
    const res = await fetch(`/api/reposting/accounts/${activeId}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      let msg = txt;
      try {
        const parsed = JSON.parse(txt) as { error?: string };
        if (parsed.error) msg = parsed.error;
      } catch {
        // plain text response
      }
      throw new Error(msg || `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition");
    const prefix = total && total > 1 ? `${String(idx + 1).padStart(2, "0")}-` : "";
    triggerBrowserDownload(blob, `${prefix}video-${idx + 1}.mp4`, cd);
  };

  const downloadRow = async (index: number) => {
    if (running || downloading) return;
    try {
      setDownloading(true);
      await downloadOne(items[index], index);
      toast.success(`Downloaded row ${index + 1}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
      setDownloadingRow(null);
    }
  };

  const downloadAll = async () => {
    if (running || downloading) return;
    const valid = items
      .map((it) => it.url.trim())
      .filter((u) => u.length > 0);
    if (valid.length === 0) {
      toast.error("Add at least one URL to download");
      return;
    }
    try {
      setDownloading(true);
      const res = await fetch(`/api/reposting/accounts/${activeId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: valid }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let msg = txt;
        try {
          const parsed = JSON.parse(txt) as { error?: string };
          if (parsed.error) msg = parsed.error;
        } catch {
          // plain text response
        }
        throw new Error(msg || `Bulk download failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      triggerBrowserDownload(blob, `videos-${Date.now()}.zip`, cd);
      toast.success(`Downloaded ZIP with ${valid.length} video(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk download failed");
    } finally {
      setDownloading(false);
      setDownloadingRow(null);
    }
  };

  const activeAccount = accounts.find((a) => a.id === activeId) ?? null;

  // ---- effects ----
  useEffect(() => {
    void refreshAccounts();
    void refreshShared();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get("yt-connected");
      if (connected) {
        toast.success("YouTube connected");
        localStorage.setItem("reposting:activeId", connected);
        const url = new URL(window.location.href);
        url.searchParams.delete("yt-connected");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  useEffect(() => {
    if (!activeId) {
      setAccountConfig(null);
      setHistory([]);
      setItems([blankRow()]);
      setPreflightItems({});
      setRunSteps({});
      setCoachReport(null);
      setPageId("");
      setFbTokenDraft("");
      return;
    }
    setRunSteps({});
    setChannelPick(null);
    localStorage.setItem("reposting:activeId", activeId);
    void refreshAccountConfig(activeId);
    void refreshHistory(activeId);
    void pollPublishStatus(activeId);
    void refreshPreflight(activeId);
    void refreshCoach(activeId);
    const savedQueue = localStorage.getItem(`reposting:queue:${activeId}`);
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue) as QueueItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
          return;
        }
      } catch {
        // ignore
      }
    }
    setItems([blankRow()]);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    localStorage.setItem(`reposting:queue:${activeId}`, JSON.stringify(items));
  }, [items, activeId]);

  useEffect(() => {
    if (!activeId) return;
    const hasPending = history.some((r) => r.status === "scheduled");
    if (!hasPending) return;
    const interval = setInterval(() => void pollPublishStatus(activeId), 60_000);
    return () => clearInterval(interval);
  }, [history, activeId]);

  const ytQueueUrls =
    activeAccount?.flow === "yt-to-fb"
      ? Array.from(
          new Set(
            items
              .map((it) => canonicalYoutubeUrl(it.url))
              .filter((url) => url.trim().length > 0),
          ),
        )
      : [];

  // ---- derived view state ----
  const flow = activeAccount?.flow ?? "yt-to-fb";
  const source = FLOW_SOURCE[flow];
  const needsFbPage = flow === "yt-to-fb" || flow === "tt-to-fb";
  const destinationReady = needsFbPage
    ? Boolean(accountConfig?.fbPageAccessToken.set && pageId.trim())
    : Boolean(accountConfig?.youtube?.connected);
  const filledItems = items.filter((it) => it.url.trim().length > 0);
  const captionedCount =
    flow === "yt-to-fb"
      ? ytQueueUrls.filter((u) => preflightItems[u]?.selectedVariantId).length
      : filledItems.length;
  const upcoming = history
    .filter((r) => r.status === "scheduled" && new Date(r.scheduledAt).getTime() > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const key = d.toDateString();
    return {
      date: d,
      scheduled: upcoming.filter((r) => new Date(r.scheduledAt).toDateString() === key).length,
      queued: filledItems.filter(
        (it) => !it.publishNow && new Date(it.scheduledAt).toDateString() === key,
      ).length,
    };
  });
  const weekScheduled = days.reduce((n, d) => n + d.scheduled, 0);
  const weekQueued = days.reduce((n, d) => n + d.queued, 0);

  // Pipeline canvas: each stage's state comes from the live schedule stream.
  const STEP_ORDER = ["metadata", "download", "caption", "upload", "done"];
  const runEntries = Object.values(runSteps);
  const runTotal = running ? filledItems.length : runEntries.length;
  const stageState = (stage: string): { status: StageStatus; progress?: string } => {
    if (runEntries.length === 0) return { status: "idle" };
    const k = STEP_ORDER.indexOf(stage);
    const passed = runEntries.filter((e) => e.step !== "error" && STEP_ORDER.indexOf(e.step) > k).length;
    const failed = runEntries.some((e) => e.step === "error" && e.at === stage);
    const inside = runEntries.some((e) => e.step === stage);
    return {
      status: failed ? "error" : inside && running ? "active" : passed > 0 && (passed >= runTotal || !running) ? "done" : passed > 0 ? "active" : "idle",
      progress: `${passed}/${runTotal}`,
    };
  };
  const doneCount = runEntries.filter((e) => e.step === "done").length;
  const destinationName = needsFbPage
    ? pageId.trim()
      ? `Page ${pageId.trim()}`
      : "No Page set"
    : accountConfig?.youtube?.connected
      ? (accountConfig.youtube.channelTitle ?? "YouTube channel")
      : "Not connected";
  const pipelineStages: PipelineStage[] = [
    {
      id: "source",
      label: "Source",
      detail: `${filledItems.length} ${source.noun}${filledItems.length === 1 ? "" : "s"}`,
      icon: source.icon,
      status: filledItems.length > 0 ? "done" : "idle",
    },
    { id: "metadata", label: "Read details", detail: "Title, channel, length", icon: <FileSearch className="size-4" />, ...stageState("metadata") },
    { id: "download", label: "Download", detail: "yt-dlp, best mp4", icon: <Download className="size-4" />, ...stageState("download") },
    {
      id: "caption",
      label: "Caption",
      detail:
        flow === "yt-to-fb"
          ? `${captionedCount} of ${ytQueueUrls.length} picked`
          : flow === "tt-to-fb"
            ? "Yours, or AI-written"
            : "From the Reel",
      icon: <Sparkles className="size-4" />,
      ...stageState("caption"),
    },
    {
      id: "upload",
      label: needsFbPage ? "Schedule" : "Upload",
      detail: needsFbPage ? "Facebook Graph API" : "YouTube Data API",
      icon: <Upload className="size-4" />,
      ...stageState("upload"),
    },
    {
      id: "dest",
      label: source.destination === "Facebook Page" ? "Facebook" : "YouTube",
      detail: destinationName,
      icon: needsFbPage ? <FacebookIcon size={16} className="text-[#1877f2]" /> : <YoutubeIcon size={16} className="text-[#ff0000]" />,
      status: !destinationReady ? "error" : doneCount > 0 ? "done" : "idle",
      progress: runEntries.length > 0 ? `${doneCount}/${runTotal}` : undefined,
    },
  ];

  // Facebook rejects schedules more than 6 months out; stop a day short.
  const MAX_AHEAD_MS = 179 * 24 * 60 * 60_000;
  const appendUrls = (urls: string[]) => {
    const next = items.filter((it) => it.url.trim().length > 0);
    let added = 0;
    for (const url of urls) {
      const last = next.at(-1);
      const scheduledAt = (last && nextDayFrom(last.scheduledAt)) ?? defaultScheduledAt(20);
      if (new Date(scheduledAt).getTime() - now > MAX_AHEAD_MS) break;
      next.push({ ...blankRow(), url, scheduledAt });
      added++;
    }
    setItems(next.length > 0 ? next : [blankRow()]);
    const skipped = urls.length - added;
    if (skipped > 0)
      toast.warning(`Added ${added}, one per day. ${skipped} left out: they would land past Facebook's 6-month limit.`);
    else toast.success(`Added ${added} link${added === 1 ? "" : "s"}, one per day`);
  };

  const addPastedUrls = () => {
    const urls = pasteDraft
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u) || /^[A-Za-z0-9_-]{11}$/.test(u));
    if (urls.length === 0) {
      toast.error("No links found. Paste one URL per line.");
      return;
    }
    appendUrls(urls);
    setPasteDraft("");
  };

  // A single pasted YouTube channel (not a video) switches the box to "list its Shorts".
  const pastedChannel =
    flow === "yt-to-fb" &&
    /^(@[\w.-]+|(https?:\/\/)?(www\.|m\.)?youtube\.com\/(@[\w.-]+|channel\/UC[\w-]{22}|c\/[\w.-]+|user\/[\w.-]+)(\/[\w-]*)?\/?(\?\S*)?)$/i.test(
      pasteDraft.trim(),
    );
  const knownVideoIds = new Set([
    ...history.map((r) => r.videoId),
    ...filledItems.map((it) => canonicalYoutubeUrl(it.url).match(/[?&]v=([\w-]{11})/)?.[1]),
  ]);

  const listChannel = async () => {
    if (!activeId) return;
    setListingChannel(true);
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/channel-shorts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: pasteDraft.trim(), limit: channelLimit }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        channel?: string;
        shorts?: Array<{ id: string; url: string; title: string }>;
        error?: string;
      };
      if (!res.ok || !data.shorts) throw new Error(data.error ?? `Listing failed (${res.status})`);
      if (data.shorts.length === 0) {
        toast.info("That channel has no Shorts.");
        return;
      }
      setChannelPick({
        channel: data.channel ?? pasteDraft.trim(),
        shorts: data.shorts,
        selected: new Set(data.shorts.filter((v) => !knownVideoIds.has(v.id)).map((v) => v.id)),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing failed");
    } finally {
      setListingChannel(false);
    }
  };

  const addPickedShorts = () => {
    if (!channelPick) return;
    // Keep the channel's order (newest first) so the newest goes out first.
    appendUrls(channelPick.shorts.filter((v) => channelPick.selected.has(v.id)).map((v) => v.url));
    setChannelPick(null);
    setPasteDraft("");
  };

  const showCoach = flow === "yt-to-fb";
  const currentTab = !showCoach && tab === "coach" ? "queue" : tab;

  const finding = !activeAccount
    ? null
    : !destinationReady
      ? needsFbPage
        ? "Facebook Page token or Page ID missing. Nothing can be scheduled until it is set."
        : "YouTube is not connected. Nothing can be uploaded until it is."
      : upcoming.length > 0
        ? `${upcoming.length} scheduled · next goes out ${fmtWhen(upcoming[0].scheduledAt)}`
        : filledItems.length > 0
          ? `${filledItems.length} in the queue, none sent yet`
          : "Nothing scheduled. Paste links below to start a queue.";

  return (
    <>
      <AppTopbar title="Reposting" icon={Repeat2}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="max-w-[16rem] text-white" disabled={running} />
            }
          >
            {activeAccount ? (
              <>
                <FlowBadge flow={activeAccount.flow} />
                <span className="truncate">{activeAccount.name}</span>
              </>
            ) : (
              <span>Choose account</span>
            )}
            <ChevronsUpDown data-icon="inline-end" className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Reposting accounts</DropdownMenuLabel>
              {[...accounts]
                .sort((a, b) =>
                  a.flow === b.flow ? a.name.localeCompare(b.name) : a.flow.localeCompare(b.flow),
                )
                .map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => setActiveId(a.id)} className="py-2">
                    <FlowBadge flow={a.flow} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{FLOW_LABELS[a.flow]}</span>
                    </span>
                    {a.id === activeId && <Check className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={openCreateDialog}>
                <Plus /> New account
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </AppTopbar>

      <div className="flex flex-1 flex-col gap-6 px-4 pt-7 pb-16 md:px-7">
        {!activeAccount ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold">Reposting</h1>
              <p className="text-sm text-muted-foreground">
                An account is one source-to-destination pipe with its own queue, token and
                history. Pick the pipe to create the first one.
              </p>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-3">
              {(["yt-to-fb", "tt-to-fb", "ig-to-yt"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setNameDialog({ mode: "create", value: `Account ${accounts.length + 1}`, flow: f })
                  }
                  className="flex cursor-pointer flex-col items-start gap-6 rounded-[20px] bg-card p-5 text-left transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <FlowBadge flow={f} size={20} />
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{FLOW_LABELS[f]}</span>
                    <span className="text-sm text-muted-foreground">
                      {FLOW_SOURCE[f].noun}s to a {FLOW_SOURCE[f].destination}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Title row: the account is the object; the finding says what needs doing. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <FlowBadge flow={activeAccount.flow} size={16} />
                  <h1 className="truncate text-xl font-semibold">{activeAccount.name}</h1>
                </div>
                <p
                  className={cn(
                    "text-sm",
                    destinationReady ? "text-muted-foreground" : "text-warning",
                  )}
                >
                  {finding}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {running ? (
                  <Button variant="destructive" onClick={stopRun}>
                    <Square data-icon="inline-start" /> Stop run
                  </Button>
                ) : !destinationReady ? (
                  <Button onClick={() => setTab("settings")}>
                    <Settings2 data-icon="inline-start" /> Finish setup
                  </Button>
                ) : (
                  <Button
                    onClick={() => void run()}
                    disabled={downloading || filledItems.length === 0}
                  >
                    <Send data-icon="inline-start" />
                    Schedule {filledItems.length > 0 ? filledItems.length : ""}
                  </Button>
                )}
              </div>
            </div>

            <Tabs value={currentTab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-6">
              <div className="-mx-4 overflow-x-auto border-b border-border px-4 md:-mx-7 md:px-7">
                <TabsList variant="line" className="h-10 gap-5 p-0">
                  <TabsTrigger value="queue" className="flex-none px-0">
                    Queue
                    <span className="num text-muted-foreground">{filledItems.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-none px-0">
                    History
                    <span className="num text-muted-foreground">{history.length}</span>
                  </TabsTrigger>
                  {showCoach && (
                    <TabsTrigger value="coach" className="flex-none px-0">
                      Coach
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="settings" className="flex-none px-0">
                    Settings
                    {!destinationReady && (
                      <span className="size-1.5 rounded-full bg-warning" aria-label="needs setup" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ---------------- Queue ---------------- */}
              <TabsContent value="queue" className="flex flex-col gap-3.5">
                <RepostPipeline stages={pipelineStages} />
                <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_384px]">
                  <div className="flex min-w-0 flex-col gap-3.5">
                    {/* Bulk paste: the fastest way to fill a queue. */}
                    <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
                      <Label htmlFor="paste-links" className="text-sm">
                        Add {source.noun} links
                      </Label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <Textarea
                          id="paste-links"
                          rows={2}
                          placeholder={`${source.placeholder}\none link per line`}
                          value={pasteDraft}
                          onChange={(e) => setPasteDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              addPastedUrls();
                            }
                          }}
                          disabled={running}
                          className="max-h-40 min-h-11"
                        />
                        {pastedChannel ? (
                          <div className="flex gap-2 sm:mt-1">
                            <select
                              aria-label="How many Shorts to list"
                              value={channelLimit ?? "all"}
                              onChange={(e) => setChannelLimit(e.target.value === "all" ? null : Number(e.target.value))}
                              disabled={listingChannel}
                              className="h-9 cursor-pointer rounded-full border border-input bg-black px-3 text-sm"
                            >
                              <option value={20}>Newest 20</option>
                              <option value={50}>Newest 50</option>
                              <option value="all">All</option>
                            </select>
                            <Button variant="outline" onClick={() => void listChannel()} disabled={running || listingChannel}>
                              {listingChannel ? (
                                <Loader2 data-icon="inline-start" className="animate-spin" />
                              ) : (
                                <ListVideo data-icon="inline-start" />
                              )}
                              {listingChannel ? "Listing…" : "List Shorts"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={addPastedUrls}
                            disabled={running || !pasteDraft.trim()}
                            className="sm:mt-1"
                          >
                            <Plus data-icon="inline-start" /> Add to queue
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-faint">
                        {flow === "yt-to-fb"
                          ? "Paste video links, or a channel link to pick from its Shorts. "
                          : ""}
                        Each new link is slotted one day after the last, up to 6 months out.
                      </p>
                      {channelPick && (
                        <div className="flex flex-col gap-3 border-t border-border pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="min-w-0 text-sm">
                              <span className="num">{channelPick.shorts.length}</span> Shorts from{" "}
                              <span className="font-medium break-all">
                                {channelPick.channel.replace(/^https:\/\/www\.youtube\.com\//, "").replace(/\/shorts$/, "")}
                              </span>
                              <span className="text-muted-foreground">
                                {" "}· <span className="num">{channelPick.selected.size}</span> selected
                              </span>
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setChannelPick((p) =>
                                    p && {
                                      ...p,
                                      selected:
                                        p.selected.size > 0
                                          ? new Set()
                                          : new Set(p.shorts.filter((v) => !knownVideoIds.has(v.id)).map((v) => v.id)),
                                    },
                                  )
                                }
                              >
                                {channelPick.selected.size > 0 ? "Select none" : "Select new"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setChannelPick(null)}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={addPickedShorts}
                                disabled={running || channelPick.selected.size === 0}
                              >
                                <Plus data-icon="inline-start" /> Add {channelPick.selected.size} to queue
                              </Button>
                            </div>
                          </div>
                          <ul className="grid max-h-[420px] gap-1 overflow-y-auto sm:grid-cols-2">
                            {channelPick.shorts.map((v) => {
                              const known = knownVideoIds.has(v.id);
                              const checked = channelPick.selected.has(v.id);
                              return (
                                <li key={v.id}>
                                  <label
                                    className={cn(
                                      "flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent",
                                      checked && "bg-raised",
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="size-4 shrink-0 accent-white"
                                      checked={checked}
                                      onChange={() =>
                                        setChannelPick((p) => {
                                          if (!p) return p;
                                          const sel = new Set(p.selected);
                                          if (sel.has(v.id)) sel.delete(v.id);
                                          else sel.add(v.id);
                                          return { ...p, selected: sel };
                                        })
                                      }
                                    />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                                      alt=""
                                      loading="lazy"
                                      className="aspect-video w-20 shrink-0 rounded-md bg-raised object-cover"
                                    />
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                      <span className={cn("line-clamp-2 text-sm", known && "text-muted-foreground")}>
                                        {v.title || v.id}
                                      </span>
                                      {known && <span className="text-xs text-faint">Already queued or posted</span>}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col rounded-[20px] bg-card">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
                        <h2 className="text-base font-medium">
                          Queue{" "}
                          <span className="num font-normal text-muted-foreground">
                            {filledItems.length}
                          </span>
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                          {flow === "yt-to-fb" && (
                            <span className="num text-xs text-muted-foreground">
                              {captionedCount} of {ytQueueUrls.length} captioned
                            </span>
                          )}
                          {flow === "yt-to-fb" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void runPreflight()}
                              disabled={runningPreflight || running || ytQueueUrls.length === 0}
                            >
                              {runningPreflight ? (
                                <Loader2 data-icon="inline-start" className="animate-spin" />
                              ) : (
                                <Sparkles data-icon="inline-start" />
                              )}
                              {runningPreflight ? "Writing captions…" : "Write captions"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void downloadAll()}
                            disabled={running || downloading || filledItems.length === 0}
                          >
                            <Download data-icon="inline-start" />
                            {downloading && downloadingRow === null ? "Zipping…" : "Download all"}
                          </Button>
                        </div>
                      </div>

                      <ol className="flex flex-col">
                        {items.map((item, i) => {
                          const key = canonicalYoutubeUrl(item.url);
                          const pf = flow === "yt-to-fb" && item.url.trim() ? preflightItems[key] : undefined;
                          const thumb = flow === "yt-to-fb" && item.url.trim() ? youtubeThumb(item.url) : null;
                          return (
                            <li
                              key={i}
                              className="grid gap-4 border-t border-border px-5 py-5 sm:grid-cols-[112px_minmax(0,1fr)]"
                            >
                              <div className="hidden aspect-video w-28 items-center justify-center overflow-hidden rounded-lg bg-raised sm:flex">
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={thumb} alt={pf?.title || "Video thumbnail"} className="size-full object-cover" loading="lazy" />
                                ) : (
                                  source.icon
                                )}
                              </div>
                              <div className="flex min-w-0 flex-col gap-3">
                                <div className="flex items-center gap-2">
                                  <Input
                                    aria-label={`${source.noun} URL, row ${i + 1}`}
                                    placeholder={source.placeholder}
                                    value={item.url}
                                    onChange={(e) => updateItem(i, { url: e.target.value })}
                                    disabled={running}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void downloadRow(i)}
                                    disabled={running || downloading || !item.url.trim()}
                                    aria-label={`Download row ${i + 1}`}
                                    title="Download this video"
                                  >
                                    {downloadingRow === i ? <Loader2 className="animate-spin" /> : <Download />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeRow(i)}
                                    disabled={running || downloading}
                                    aria-label={`Remove row ${i + 1}`}
                                    title="Remove"
                                  >
                                    <Trash2 />
                                  </Button>
                                </div>
                                {pf?.title && <p className="truncate text-sm font-medium">{pf.title}</p>}

                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="datetime-local"
                                    aria-label={`Scheduled time, row ${i + 1}`}
                                    value={item.scheduledAt}
                                    onChange={(e) => updateItem(i, { scheduledAt: e.target.value })}
                                    disabled={running || item.publishNow}
                                    className="num w-auto"
                                  />
                                  {[
                                    { label: "+12h", minutes: 12 * 60 },
                                    { label: "+1d", minutes: 24 * 60 },
                                    { label: "+2d", minutes: 2 * 24 * 60 },
                                  ].map((preset) => (
                                    <Button
                                      key={preset.label}
                                      size="xs"
                                      variant="outline"
                                      onClick={() =>
                                        updateItem(i, {
                                          scheduledAt: defaultScheduledAt(preset.minutes),
                                          publishNow: false,
                                        })
                                      }
                                      disabled={running}
                                      aria-label={`Schedule ${preset.label} from now`}
                                    >
                                      {preset.label}
                                    </Button>
                                  ))}
                                  <label className="ml-1 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                                    <Switch
                                      checked={item.publishNow}
                                      onCheckedChange={(v) => updateItem(i, { publishNow: v })}
                                      disabled={running || downloading}
                                    />
                                    Post now
                                  </label>
                                </div>

                                {flow === "yt-to-fb" && item.url.trim() && (
                                  <div className="flex flex-col gap-2">
                                    {!pf ? (
                                      <p className="text-sm text-faint">
                                        No caption yet. Write captions drafts three to pick from.
                                      </p>
                                    ) : (
                                      <div role="radiogroup" aria-label={`Caption for row ${i + 1}`} className="flex flex-col gap-1.5">
                                        {pf.variants.map((variant) => {
                                          const selected = pf.selectedVariantId === variant.id;
                                          return (
                                            <button
                                              key={variant.id}
                                              type="button"
                                              role="radio"
                                              aria-checked={selected}
                                              disabled={running || approvingPreflight === key}
                                              onClick={() => void approvePreflight({ url: key, variantId: variant.id })}
                                              className={cn(
                                                "grid cursor-pointer grid-cols-[16px_minmax(0,1fr)] gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait",
                                                selected ? "bg-raised text-white" : "text-muted-foreground hover:bg-accent hover:text-white",
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "mt-0.5 flex size-4 items-center justify-center rounded-full border",
                                                  selected ? "border-data bg-data text-black" : "border-input",
                                                )}
                                              >
                                                {selected && <Check className="size-3" strokeWidth={3} />}
                                              </span>
                                              <span className="flex flex-col gap-0.5">
                                                <span className="text-xs text-faint capitalize">{variant.hookType || "general"}</span>
                                                <span className="whitespace-pre-line">{variant.text}</span>
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {flow === "tt-to-fb" && (
                                  <div className="flex flex-col gap-2">
                                    <Label htmlFor={`caption-${i}`} className="text-muted-foreground">
                                      Caption · blank lets AI write it
                                    </Label>
                                    <Textarea
                                      id={`caption-${i}`}
                                      rows={2}
                                      value={item.caption ?? ""}
                                      onChange={(e) => updateItem(i, { caption: e.target.value })}
                                      disabled={running}
                                    />
                                  </div>
                                )}

                                {needsFbPage &&
                                  (item.comment !== undefined ? (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                        <Label htmlFor={`comment-${i}`} className="text-muted-foreground">
                                          First comment
                                        </Label>
                                        <button
                                          type="button"
                                          className="cursor-pointer text-xs text-muted-foreground hover:text-white"
                                          onClick={() => updateItem(i, { comment: undefined })}
                                          disabled={running}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      <Textarea
                                        id={`comment-${i}`}
                                        rows={2}
                                        placeholder="Links, CTAs or hashtags posted under the video"
                                        value={item.comment}
                                        onChange={(e) => updateItem(i, { comment: e.target.value })}
                                        disabled={running}
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-white"
                                      onClick={() => updateItem(i, { comment: "" })}
                                      disabled={running}
                                    >
                                      <MessageSquarePlus className="size-4" /> Add first comment
                                    </button>
                                  ))}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                      <div className="border-t border-border px-5 py-3">
                        <Button variant="ghost" size="sm" onClick={addRow} disabled={running || downloading}>
                          <Plus data-icon="inline-start" /> Add empty row
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Rail: the week ahead, the live run, the latest results. */}
                  <aside className="flex min-w-0 flex-col gap-3.5">
                    <div className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
                      <SectionHeading>Next 7 days</SectionHeading>
                      <div className="grid grid-cols-7 gap-1.5">
                        {days.map((d, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-2">
                            <span className={cn("text-xs", idx === 0 ? "text-white" : "text-faint")}>
                              {d.date.toLocaleDateString(undefined, { weekday: "narrow" })}
                            </span>
                            <div
                              className="flex h-24 w-full flex-col-reverse items-center gap-1 rounded-lg bg-black p-1.5"
                              title={`${d.scheduled} scheduled, ${d.queued} in queue`}
                            >
                              {Array.from({ length: Math.min(d.scheduled, 6) }).map((_, k) => (
                                <span key={`s${k}`} className="h-2 w-full rounded-full bg-data" />
                              ))}
                              {Array.from({ length: Math.min(d.queued, Math.max(0, 6 - d.scheduled)) }).map((_, k) => (
                                <span key={`q${k}`} className="h-2 w-full rounded-full border border-white/60" />
                              ))}
                            </div>
                            <span className="num text-xs text-muted-foreground">{d.date.getDate()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-3 rounded-full bg-data" />
                          <span className="num">{weekScheduled}</span> scheduled
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-3 rounded-full border border-white/60" />
                          <span className="num">{weekQueued}</span> in queue, not sent
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
                      <SectionHeading
                        action={
                          running && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Running" />
                        }
                      >
                        Run log
                      </SectionHeading>
                      {log.length === 0 ? (
                        <p className="text-sm text-faint">Each step of the next run shows here.</p>
                      ) : (
                        <pre className="max-h-72 overflow-y-auto rounded-xl bg-black p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                          {log.join("\n")}
                        </pre>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 rounded-[20px] bg-card p-5">
                      <SectionHeading
                        action={
                          history.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setTab("history")}>
                              View all
                            </Button>
                          )
                        }
                      >
                        Recent
                      </SectionHeading>
                      {history.length === 0 ? (
                        <p className="pt-1 text-sm text-faint">Scheduled and posted videos appear here.</p>
                      ) : (
                        <ul className="flex flex-col">
                          {history.slice(0, 4).map((r, i) => (
                            <li key={i} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm">{r.caption || r.url}</span>
                                <span className="num text-xs text-faint">{fmtWhen(r.scheduledAt)}</span>
                              </div>
                              <StatusBadge status={r.status} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </aside>
                </div>
              </TabsContent>

              {/* ---------------- History ---------------- */}
              <TabsContent value="history">
                <div className="flex flex-col rounded-[20px] bg-card">
                  <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
                    <h2 className="text-base font-medium">
                      History <span className="num font-normal text-muted-foreground">{history.length}</span>
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => activeId && void pollPublishStatus(activeId)}
                    >
                      <RefreshCcw data-icon="inline-start" /> Check status
                    </Button>
                  </div>
                  {history.length === 0 ? (
                    <p className="border-t border-border px-5 py-6 text-sm text-faint">
                      Nothing has been scheduled from this account yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-faint">
                            <th className="px-5 py-2.5 font-normal">Status</th>
                            <th className="px-3 py-2.5 font-normal">Video and caption</th>
                            <th className="px-3 py-2.5 text-right font-normal">Scheduled for</th>
                            <th className="px-3 py-2.5 text-right font-normal">Published</th>
                            <th className="px-5 py-2.5 text-right font-normal">Post ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((r, i) => (
                            <tr key={i} className={cn("border-t border-border align-top", r.status === "deleted" && "text-muted-foreground")}>
                              <td className="px-5 py-3.5">
                                <StatusBadge status={r.status} />
                              </td>
                              <td className="max-w-0 px-3 py-3.5">
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn("block truncate hover:underline", r.status === "deleted" && "line-through")}
                                >
                                  {r.url}
                                </a>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.caption || "—"}</p>
                                {r.error && <p className="mt-1 text-xs text-danger-ink">{r.error}</p>}
                              </td>
                              <td className="num px-3 py-3.5 text-right whitespace-nowrap">{fmtWhen(r.scheduledAt)}</td>
                              <td className="num px-3 py-3.5 text-right whitespace-nowrap text-muted-foreground">
                                {r.publishedAt ? fmtWhen(r.publishedAt) : "—"}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-xs text-muted-foreground" title={r.fbPostId}>
                                {r.fbPostId ? `${r.fbPostId.slice(0, 10)}…` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ---------------- Coach ---------------- */}
              {showCoach && (
                <TabsContent value="coach">
                  <div className="flex flex-col gap-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {coachReport
                          ? `Last 7 days, ${new Date(coachReport.windowStart).toLocaleDateString()} to ${new Date(coachReport.windowEnd).toLocaleDateString()} · generated ${fmtWhen(coachReport.generatedAt)}`
                          : "No report yet. The coach reads the last 7 days of this account's history."}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => void refreshCoach(activeAccount.id)} disabled={runningCoach || running}>
                          Load saved
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void refreshCoachNow()} disabled={runningCoach || running}>
                          {runningCoach ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Brain data-icon="inline-start" />}
                          {runningCoach ? "Reading history…" : "Refresh insights"}
                        </Button>
                      </div>
                    </div>
                    {coachReport && (
                      <>
                        <dl className="grid grid-cols-2 overflow-hidden rounded-[20px] bg-card sm:grid-cols-3 lg:grid-cols-6">
                          {[
                            { label: "Total", value: coachReport.metrics.total },
                            { label: "Posted", value: coachReport.metrics.posted },
                            { label: "Scheduled", value: coachReport.metrics.scheduled },
                            { label: "Failed", value: coachReport.metrics.failed, bad: coachReport.metrics.failed > 0 },
                            { label: "Avg caption", value: coachReport.metrics.avgCaptionLength, unit: "chars" },
                            { label: "Avg hashtags", value: coachReport.metrics.avgHashtags },
                          ].map((m) => (
                            <div key={m.label} className="flex flex-col gap-1 border-border p-5 not-last:border-r max-lg:nth-[2n]:border-r-0">
                              <dt className="text-sm text-muted-foreground">{m.label}</dt>
                              <dd className={cn("num text-2xl font-medium", m.bad && "text-danger-ink")}>
                                {m.value}
                                {m.unit && <span className="ml-1 text-sm text-faint">{m.unit}</span>}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="grid items-start gap-3.5 lg:grid-cols-3">
                          {[
                            { title: "Findings", lines: coachReport.findings },
                            { title: "Recommendations", lines: coachReport.recommendations },
                            { title: "Next 7 days", lines: coachReport.playbook },
                          ].map((block) => (
                            <div key={block.title} className="flex flex-col gap-3 rounded-[20px] bg-card p-5">
                              <h2 className="text-base font-medium">{block.title}</h2>
                              {block.lines.length === 0 ? (
                                <p className="text-sm text-faint">Nothing to report.</p>
                              ) : (
                                <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-muted-foreground marker:text-faint">
                                  {block.lines.map((line, i) => (
                                    <li key={i}>{line}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* ---------------- Settings ---------------- */}
              <TabsContent value="settings">
                <div className="flex max-w-5xl flex-col">
                  {needsFbPage ? (
                    <SettingsRow
                      title="Facebook destination"
                      description={
                        <>
                          The Page this account posts to. Page tokens expire about every 60 days;
                          if posting stops working, paste a fresh one here.
                        </>
                      }
                    >
                      <SecretField
                        id="fb-token"
                        label="Page access token"
                        value={fbTokenDraft}
                        onChange={setFbTokenDraft}
                        placeholder={accountConfig?.fbPageAccessToken.masked ?? "EAAG…"}
                        isSet={accountConfig?.fbPageAccessToken.set}
                        onClear={() => void clearAccountKey("fbPageAccessToken")}
                        disabled={savingAccount}
                      />
                      <SecretField
                        id="fb-page"
                        label="Page ID"
                        value={pageId}
                        onChange={setPageId}
                        placeholder="1234567890"
                        isSet={accountConfig?.defaultPageId.set}
                        onClear={() => void clearAccountKey("defaultPageId")}
                        disabled={running}
                        secret={false}
                      />
                      <div className="flex justify-end">
                        <Button onClick={() => void saveAccountConfig()} disabled={savingAccount}>
                          {savingAccount ? "Saving…" : "Save destination"}
                        </Button>
                      </div>
                    </SettingsRow>
                  ) : (
                    <SettingsRow
                      title="YouTube destination"
                      description="The Google account this pipe uploads to. The default API quota allows about 6 uploads a day per Google project."
                    >
                      {accountConfig?.youtube?.connected ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-2 font-medium">
                              <CircleCheck className="size-4 text-data" />
                              {accountConfig.youtube.channelTitle ?? "Unknown channel"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Connected {fmtWhen(accountConfig.youtube.connectedAt)}
                              {accountConfig.youtube.channelId && (
                                <> · <span className="font-mono">{accountConfig.youtube.channelId}</span></>
                              )}
                            </span>
                          </div>
                          <Button variant="outline" onClick={() => void disconnectYoutube()}>
                            <Unplug data-icon="inline-start" /> Disconnect
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">Not connected.</p>
                          <Button
                            render={<a href={`/api/reposting/oauth/youtube/start?accountId=${activeAccount.id}`} />}
                            nativeButton={false}
                          >
                            <LinkIcon data-icon="inline-start" /> Connect YouTube
                          </Button>
                        </div>
                      )}
                    </SettingsRow>
                  )}

                  <SettingsRow
                    title="Shared keys"
                    description="Used by every reposting account: the YouTube Data API for video details, OpenRouter for captions and the coach."
                  >
                    <SecretField
                      id="yt-key"
                      label="YouTube API key"
                      value={youtubeKeyDraft}
                      onChange={setYoutubeKeyDraft}
                      placeholder={sharedConfig?.youtubeApiKey.masked ?? "AIza…"}
                      isSet={sharedConfig?.youtubeApiKey.set}
                      onClear={() => void clearSharedKey("youtubeApiKey")}
                      disabled={savingShared}
                    />
                    <SecretField
                      id="or-key"
                      label="OpenRouter API key"
                      value={openrouterKeyDraft}
                      onChange={setOpenrouterKeyDraft}
                      placeholder={sharedConfig?.openrouterApiKey.masked ?? "sk-or-v1-…"}
                      isSet={sharedConfig?.openrouterApiKey.set}
                      onClear={() => void clearSharedKey("openrouterApiKey")}
                      disabled={savingShared}
                    />
                    <SecretField
                      id="or-model"
                      label="OpenRouter model"
                      value={openrouterModelDraft}
                      onChange={setOpenrouterModelDraft}
                      placeholder={sharedConfig?.openrouterModel.value ?? "anthropic/claude-haiku-4.5"}
                      isSet={sharedConfig?.openrouterModel.set}
                      onClear={() => void clearSharedKey("openrouterModel")}
                      clearLabel="Use default"
                      disabled={savingShared}
                      secret={false}
                    />
                    <div className="flex justify-end">
                      <Button onClick={() => void saveShared()} disabled={savingShared}>
                        {savingShared ? "Saving…" : "Save keys"}
                      </Button>
                    </div>
                  </SettingsRow>

                  <SettingsRow
                    title="Account"
                    description="Renaming changes only the label. Deleting hides the account; its history stays on disk."
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{activeAccount.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {FLOW_LABELS[activeAccount.flow]} · created {new Date(activeAccount.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={openRenameDialog} disabled={running}>
                          <Pencil data-icon="inline-start" /> Rename
                        </Button>
                        <Button variant="destructive" onClick={() => setDeleteDialogId(activeId)} disabled={running}>
                          <Trash2 data-icon="inline-start" /> Delete
                        </Button>
                      </div>
                    </div>
                  </SettingsRow>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={nameDialog !== null} onOpenChange={(o) => !o && setNameDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {nameDialog?.mode === "rename" ? "Rename account" : "New reposting account"}
            </DialogTitle>
            <DialogDescription>
              {nameDialog?.mode === "rename"
                ? "Only the label changes. Queue, token and history stay."
                : "Each account holds its own destination, token, queue and history."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {nameDialog?.mode === "create" && (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Flow">
                <Label>Pipe</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(["yt-to-fb", "tt-to-fb", "ig-to-yt"] as const).map((f) => {
                    const selected = nameDialog.flow === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setNameDialog((d) => (d?.mode === "create" ? { ...d, flow: f } : d))
                        }
                        className={cn(
                          "flex cursor-pointer flex-col items-start gap-3 rounded-xl p-3 text-left ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          selected ? "bg-raised ring-white" : "ring-border hover:bg-accent",
                        )}
                      >
                        <FlowBadge flow={f} size={18} />
                        <span className="text-sm font-medium">{FLOW_LABELS[f]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                autoFocus
                value={nameDialog?.value ?? ""}
                onChange={(e) => setNameDialog((d) => (d ? { ...d, value: e.target.value } : d))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitNameDialog();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNameDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitNameDialog} disabled={!nameDialog?.value.trim()}>
              {nameDialog?.mode === "rename" ? "Save" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogId !== null} onOpenChange={(o) => !o && setDeleteDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{accounts.find((a) => a.id === deleteDialogId)?.name ?? ""}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the list. Its history is kept on disk and can be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteAccount}>
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
