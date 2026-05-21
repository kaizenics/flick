"use client";

import { useEffect, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  KeyRound,
  Eye,
  EyeOff,
  CircleCheck,
  Clock,
  CircleX,
  Pencil,
  ArrowRight,
  Link as LinkIcon,
  Unplug,
  Square,
  Download,
  Flame,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Brain,
} from "lucide-react";
import { toast } from "sonner";
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

type DiscoverCandidate = {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  thumbUrl: string;
  discoveredAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  viralScore?: number;
  scoreBreakdown?: {
    velocity: number;
    freshness: number;
    engagement: number;
    relevance: number;
    feedback: number;
    total: number;
  };
  matchedKeywords?: string[];
  sourceQuery?: string;
  channelStatsSnapshot?: {
    posted: number;
    failed: number;
    totalSeen: number;
  };
  lastEvaluatedAt?: string;
};

type ViralProfile = {
  niche: string;
  audience: string;
  language: string;
  seedKeywords: string[];
  excludeKeywords: string[];
  autoRefreshEnabled: boolean;
  autoRefreshMinutes: number;
  minViralScore: number;
  autoAppendEnabled: boolean;
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

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function parseKeywordList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function stringifyKeywordList(items: string[]): string {
  return items.join(", ");
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function preflightStatusTone(status: PreflightApprovalStatus): string {
  if (status === "approved") return "text-green-600";
  if (status === "overridden") return "text-amber-600";
  if (status === "blocked") return "text-red-600";
  return "text-muted-foreground";
}

const blankRow = (offset = 20): QueueItem => ({
  url: "",
  scheduledAt: defaultScheduledAt(offset),
  publishNow: false,
});

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
  const [showYoutube, setShowYoutube] = useState(false);
  const [showOpenrouter, setShowOpenrouter] = useState(false);

  // per-account config
  const [accountConfig, setAccountConfig] = useState<AccountConfigMasked | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [pageId, setPageId] = useState("");
  const [fbTokenDraft, setFbTokenDraft] = useState("");
  const [showFb, setShowFb] = useState(false);

  // dialogs
  const [nameDialog, setNameDialog] = useState<
    | { mode: "create"; value: string; flow: Flow }
    | { mode: "rename"; value: string; id: string }
    | null
  >(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);

  // queue & run
  const [items, setItems] = useState<QueueItem[]>([blankRow()]);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingRow, setDownloadingRow] = useState<number | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [history, setHistory] = useState<ScheduledRecord[]>([]);
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [candidateSelection, setCandidateSelection] = useState<Record<string, boolean>>({});
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverMaxResults, setDiscoverMaxResults] = useState(10);
  const [discoverFreshnessDays, setDiscoverFreshnessDays] = useState(7);
  const [discovering, setDiscovering] = useState(false);
  const [discoverClearing, setDiscoverClearing] = useState(false);
  const [preflightItems, setPreflightItems] = useState<Record<string, PreflightItemState>>({});
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [approvingPreflight, setApprovingPreflight] = useState<string | null>(null);
  const [coachReport, setCoachReport] = useState<CoachReport | null>(null);
  const [runningCoach, setRunningCoach] = useState(false);
  const [viralProfile, setViralProfile] = useState<ViralProfile | null>(null);
  const [savingViralProfile, setSavingViralProfile] = useState(false);
  const [runningViral, setRunningViral] = useState(false);
  const [appendingTop, setAppendingTop] = useState(false);
  const [autoCycleTick, setAutoCycleTick] = useState(0);

  const [nicheDraft, setNicheDraft] = useState("");
  const [audienceDraft, setAudienceDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("");
  const [seedKeywordsDraft, setSeedKeywordsDraft] = useState("");
  const [excludeKeywordsDraft, setExcludeKeywordsDraft] = useState("");
  const [autoRefreshEnabledDraft, setAutoRefreshEnabledDraft] = useState(false);
  const [autoRefreshMinutesDraft, setAutoRefreshMinutesDraft] = useState(360);
  const [minViralScoreDraft, setMinViralScoreDraft] = useState(65);
  const [autoAppendEnabledDraft, setAutoAppendEnabledDraft] = useState(false);

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

  // ---- discover ----
  const refreshCandidates = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/discover`);
      if (!res.ok) return;
      const data = (await res.json()) as { items: DiscoverCandidate[] };
      setCandidates(
        [...data.items].sort(
          (a, b) => (b.viralScore ?? -1) - (a.viralScore ?? -1) || b.viewCount - a.viewCount,
        ),
      );
      setCandidateSelection((prev) => {
        const next: Record<string, boolean> = {};
        for (const item of data.items) {
          if (prev[item.url]) next[item.url] = true;
        }
        return next;
      });
    } catch {
      // ignore
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
    overrideReason?: string;
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

  const refreshViralProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/discover/viral-profile`);
      if (!res.ok) {
        setViralProfile(null);
        return;
      }
      const data = (await res.json()) as ViralProfile;
      setViralProfile(data);
      setNicheDraft(data.niche);
      setAudienceDraft(data.audience);
      setLanguageDraft(data.language);
      setSeedKeywordsDraft(stringifyKeywordList(data.seedKeywords));
      setExcludeKeywordsDraft(stringifyKeywordList(data.excludeKeywords));
      setAutoRefreshEnabledDraft(data.autoRefreshEnabled);
      setAutoRefreshMinutesDraft(data.autoRefreshMinutes);
      setMinViralScoreDraft(data.minViralScore);
      setAutoAppendEnabledDraft(data.autoAppendEnabled);
    } catch {
      // ignore
    }
  };

  const saveViralProfile = async () => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    setSavingViralProfile(true);
    try {
      const payload: ViralProfile = {
        niche: nicheDraft.trim(),
        audience: audienceDraft.trim(),
        language: languageDraft.trim(),
        seedKeywords: parseKeywordList(seedKeywordsDraft),
        excludeKeywords: parseKeywordList(excludeKeywordsDraft),
        autoRefreshEnabled: autoRefreshEnabledDraft,
        autoRefreshMinutes: autoRefreshMinutesDraft,
        minViralScore: minViralScoreDraft,
        autoAppendEnabled: autoAppendEnabledDraft,
      };
      const res = await fetch(`/api/reposting/accounts/${activeId}/discover/viral-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ViralProfile;
      setViralProfile(data);
      setNicheDraft(data.niche);
      setAudienceDraft(data.audience);
      setLanguageDraft(data.language);
      setSeedKeywordsDraft(stringifyKeywordList(data.seedKeywords));
      setExcludeKeywordsDraft(stringifyKeywordList(data.excludeKeywords));
      setAutoRefreshEnabledDraft(data.autoRefreshEnabled);
      setAutoRefreshMinutesDraft(data.autoRefreshMinutes);
      setMinViralScoreDraft(data.minViralScore);
      setAutoAppendEnabledDraft(data.autoAppendEnabled);
      toast.success("Viral profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingViralProfile(false);
    }
  };

  const runDiscover = async () => {
    if (!activeId || !activeAccount) return;
    const query = discoverQuery.trim();
    if (!query) {
      toast.error("Enter a discovery query first");
      return;
    }
    setDiscovering(true);
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/discover/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          maxResults: discoverMaxResults,
          freshnessDays: discoverFreshnessDays,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: DiscoverCandidate[];
        added?: number;
        updated?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Discover failed (${res.status})`);
      }
      setCandidates(
        [...(data.items ?? [])].sort(
          (a, b) => (b.viralScore ?? -1) - (a.viralScore ?? -1) || b.viewCount - a.viewCount,
        ),
      );
      setCandidateSelection({});
      toast.success(
        `Discover complete: ${data.added ?? 0} new, ${data.updated ?? 0} updated`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discover failed");
    } finally {
      setDiscovering(false);
    }
  };

  const clearDiscover = async () => {
    if (!activeId) return;
    setDiscoverClearing(true);
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/discover`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setCandidates([]);
      setCandidateSelection({});
      toast.success("Cleared discovered candidates");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setDiscoverClearing(false);
    }
  };

  const appendTopCandidates = async (opts?: { silent?: boolean }) => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    setAppendingTop(true);
    try {
      const today = dateKey(new Date());
      const queueToday = items.filter((it) => {
        const parsed = new Date(it.scheduledAt);
        if (Number.isNaN(parsed.getTime())) return false;
        return dateKey(parsed) === today;
      }).length;
      const historyToday = history.filter((r) => {
        const parsed = new Date(r.scheduledAt || r.createdAt);
        if (Number.isNaN(parsed.getTime())) return false;
        return dateKey(parsed) === today && (r.status === "scheduled" || r.status === "posted");
      }).length;

      const res = await fetch(`/api/reposting/accounts/${activeId}/discover/append-top`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingTodayCount: queueToday + historyToday,
          queueUrls: items.map((it) => it.url),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        selectedUrls?: string[];
        cap?: number;
        remainingSlots?: number;
        skipped?: { lowScore: number; duplicate: number; capLimited: number };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Append top failed (${res.status})`);

      const selected = data.selectedUrls ?? [];
      if (selected.length === 0) {
        if (!opts?.silent) {
          toast.info(
            `No candidates appended. Slots: ${data.remainingSlots ?? 0}, low-score skipped: ${data.skipped?.lowScore ?? 0}.`,
          );
        }
        return;
      }

      const queueSet = new Set(items.map((it) => canonicalYoutubeUrl(it.url)));
      const historySet = new Set(history.map((h) => canonicalYoutubeUrl(h.url)));
      const toAdd: string[] = [];
      for (const raw of selected) {
        const url = canonicalYoutubeUrl(raw);
        if (queueSet.has(url) || historySet.has(url) || toAdd.includes(url)) continue;
        toAdd.push(url);
      }
      if (toAdd.length === 0) {
        if (!opts?.silent) toast.info("Nothing appended after final local dedup.");
        return;
      }

      setItems((prev) => {
        const next = [...prev];
        for (const url of toAdd) {
          const last = next.at(-1);
          const scheduledAt = last ? nextDayFrom(last.scheduledAt) : null;
          next.push({
            ...blankRow(),
            url,
            scheduledAt: scheduledAt ?? defaultScheduledAt(20),
            publishNow: false,
          });
        }
        return next;
      });

      if (!opts?.silent) {
        toast.success(
          `Appended ${toAdd.length} top candidate${toAdd.length === 1 ? "" : "s"} (daily cap ${data.cap ?? "-"}).`,
        );
      }
    } catch (e) {
      if (!opts?.silent) {
        toast.error(e instanceof Error ? e.message : "Append top failed");
      }
    } finally {
      setAppendingTop(false);
    }
  };

  const runViralNow = async (opts?: { silent?: boolean }) => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    setRunningViral(true);
    try {
      const res = await fetch(`/api/reposting/accounts/${activeId}/discover/viral-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxResults: discoverMaxResults,
          freshnessDays: discoverFreshnessDays,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: DiscoverCandidate[];
        added?: number;
        updated?: number;
        queries?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Viral run failed (${res.status})`);
      const ranked = [...(data.items ?? [])].sort(
        (a, b) => (b.viralScore ?? -1) - (a.viralScore ?? -1) || b.viewCount - a.viewCount,
      );
      setCandidates(ranked);
      setCandidateSelection({});
      if (!opts?.silent) {
        toast.success(
          `Viral run complete: ${data.added ?? 0} new, ${data.updated ?? 0} updated, ${data.queries?.length ?? 0} queries.`,
        );
      }
      const profile = viralProfile;
      if (profile?.autoAppendEnabled) {
        await appendTopCandidates({ silent: Boolean(opts?.silent) });
      }
    } catch (e) {
      if (!opts?.silent) {
        toast.error(e instanceof Error ? e.message : "Viral run failed");
      }
    } finally {
      setRunningViral(false);
    }
  };

  const appendSelectedCandidatesToQueue = () => {
    if (!activeAccount || activeAccount.flow !== "yt-to-fb") return;
    const selectedUrls = candidates
      .filter((c) => candidateSelection[c.url])
      .map((c) => canonicalYoutubeUrl(c.url));
    if (selectedUrls.length === 0) {
      toast.error("Select at least one discovered candidate");
      return;
    }

    const queueSet = new Set(items.map((it) => canonicalYoutubeUrl(it.url)));
    const historySet = new Set(history.map((h) => canonicalYoutubeUrl(h.url)));
    const uniqueSelection = Array.from(new Set(selectedUrls));
    const toAdd: string[] = [];
    let skipped = 0;
    for (const url of uniqueSelection) {
      if (queueSet.has(url) || historySet.has(url)) {
        skipped += 1;
        continue;
      }
      toAdd.push(url);
      queueSet.add(url);
    }
    if (toAdd.length === 0) {
      toast.info("Nothing added: all selected items already exist in queue/history");
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      for (const url of toAdd) {
        const last = next.at(-1);
        const scheduledAt = last ? nextDayFrom(last.scheduledAt) : null;
        next.push({
          ...blankRow(),
          url,
          scheduledAt: scheduledAt ?? defaultScheduledAt(20),
          publishNow: false,
        });
      }
      return next;
    });

    toast.success(
      `Added ${toAdd.length} discovered URL${toAdd.length === 1 ? "" : "s"} to queue${skipped ? `, skipped ${skipped}` : ""}`,
    );
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
        if (!pf.selectedVariantId || !["approved", "overridden"].includes(pf.approvalStatus)) {
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
        toast.error(
          "Some URLs are not approved. Approve safe captions or provide override reasons for blocked ones.",
        );
        return;
      }
      valid = nextValid;
    }

    setLog([]);
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
      setCandidates([]);
      setCandidateSelection({});
      setPreflightItems({});
      setCoachReport(null);
      setViralProfile(null);
      setPageId("");
      setFbTokenDraft("");
      return;
    }
    localStorage.setItem("reposting:activeId", activeId);
    void refreshAccountConfig(activeId);
    void refreshHistory(activeId);
    void pollPublishStatus(activeId);
    void refreshCandidates(activeId);
    void refreshPreflight(activeId);
    void refreshCoach(activeId);
    void refreshViralProfile(activeId);
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

  useEffect(() => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    if (!viralProfile?.autoRefreshEnabled) return;
    const everyMinutes = Math.max(15, viralProfile.autoRefreshMinutes || 360);
    const interval = setInterval(() => {
      setAutoCycleTick((n) => n + 1);
    }, everyMinutes * 60_000);
    return () => clearInterval(interval);
  }, [activeId, activeAccount, viralProfile?.autoRefreshEnabled, viralProfile?.autoRefreshMinutes]);

  useEffect(() => {
    if (autoCycleTick === 0) return;
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
    if (!viralProfile?.autoRefreshEnabled) return;
    if (running || runningViral || appendingTop) return;
    void runViralNow({ silent: true });
  }, [
    autoCycleTick,
    activeId,
    activeAccount,
    viralProfile?.autoRefreshEnabled,
    running,
    runningViral,
    appendingTop,
  ]);

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

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-2">
          <Repeat2 className="size-4" />
          <h1 className="text-sm font-medium">Reposting</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {activeAccount ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-xs">
              <FlowBadge flow={activeAccount.flow} />
              <span className="font-medium">{activeAccount.name}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={openRenameDialog}
                disabled={running}
                title="Rename"
                className="size-5"
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDeleteDialogId(activeId)}
                disabled={running}
                title="Delete"
                className="size-5"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No account selected</span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSwitchOpen(true)}
            disabled={running || accounts.length === 0}
          >
            <ArrowRight className="size-4" /> Switch account
          </Button>
          <Button size="sm" variant="outline" onClick={openCreateDialog} disabled={running}>
            <Plus className="size-4" /> Add Account
          </Button>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-6">
        {/* Shared settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Shared settings
            </CardTitle>
            <CardDescription>
              Used by every reposting account. Stored in <code>data/reposting/shared.json</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs">YouTube API key</Label>
                <div className="relative">
                  <Input
                    type={showYoutube ? "text" : "password"}
                    placeholder={
                      sharedConfig?.youtubeApiKey.set
                        ? sharedConfig.youtubeApiKey.masked ?? ""
                        : "AIza…"
                    }
                    value={youtubeKeyDraft}
                    onChange={(e) => setYoutubeKeyDraft(e.target.value)}
                    disabled={savingShared}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowYoutube((v) => !v)}
                    tabIndex={-1}
                  >
                    {showYoutube ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {sharedConfig?.youtubeApiKey.set && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => clearSharedKey("youtubeApiKey")}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div>
                <Label className="text-xs">OpenRouter API key</Label>
                <div className="relative">
                  <Input
                    type={showOpenrouter ? "text" : "password"}
                    placeholder={
                      sharedConfig?.openrouterApiKey.set
                        ? sharedConfig.openrouterApiKey.masked ?? ""
                        : "sk-or-v1-…"
                    }
                    value={openrouterKeyDraft}
                    onChange={(e) => setOpenrouterKeyDraft(e.target.value)}
                    disabled={savingShared}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowOpenrouter((v) => !v)}
                    tabIndex={-1}
                  >
                    {showOpenrouter ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {sharedConfig?.openrouterApiKey.set && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => clearSharedKey("openrouterApiKey")}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div>
                <Label className="text-xs">OpenRouter model</Label>
                <Input
                  type="text"
                  placeholder={
                    sharedConfig?.openrouterModel.set
                      ? sharedConfig.openrouterModel.value ?? ""
                      : "anthropic/claude-haiku-4.5"
                  }
                  value={openrouterModelDraft}
                  onChange={(e) => setOpenrouterModelDraft(e.target.value)}
                  disabled={savingShared}
                />
                {sharedConfig?.openrouterModel.set && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => clearSharedKey("openrouterModel")}
                  >
                    Clear (revert to default)
                  </button>
                )}
              </div>
            </div>
            <Button onClick={saveShared} disabled={savingShared}>
              {savingShared ? "Saving…" : "Save shared settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Per-account: destination + queue + history */}
        {activeAccount && (
          <>
            {activeAccount.flow === "yt-to-fb" || activeAccount.flow === "tt-to-fb" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FacebookIcon size={16} className="text-[#1877f2]" />
                    {activeAccount.name} — Facebook destination
                  </CardTitle>
                  <CardDescription>
                    Page Access Token + default Page ID for this account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Facebook Page Access Token</Label>
                      <div className="relative">
                        <Input
                          type={showFb ? "text" : "password"}
                          placeholder={
                            accountConfig?.fbPageAccessToken.set
                              ? accountConfig.fbPageAccessToken.masked ?? ""
                              : "EAAG…"
                          }
                          value={fbTokenDraft}
                          onChange={(e) => setFbTokenDraft(e.target.value)}
                          disabled={savingAccount}
                          className="pr-9"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowFb((v) => !v)}
                          tabIndex={-1}
                        >
                          {showFb ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {accountConfig?.fbPageAccessToken.set && (
                        <button
                          type="button"
                          className="mt-1 text-xs text-muted-foreground underline"
                          onClick={() => clearAccountKey("fbPageAccessToken")}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Page ID</Label>
                      <Input
                        placeholder="1234567890"
                        value={pageId}
                        onChange={(e) => setPageId(e.target.value)}
                        disabled={running}
                      />
                      {accountConfig?.defaultPageId.set && (
                        <button
                          type="button"
                          className="mt-1 text-xs text-muted-foreground underline"
                          onClick={() => clearAccountKey("defaultPageId")}
                        >
                          Clear saved Page ID
                        </button>
                      )}
                    </div>
                  </div>
                  <Button onClick={saveAccountConfig} disabled={savingAccount}>
                    {savingAccount ? "Saving…" : "Save account settings"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <YoutubeIcon size={16} className="text-[#ff0000]" />
                    {activeAccount.name} — YouTube destination
                  </CardTitle>
                  <CardDescription>
                    Connect this account to a Google account with YouTube upload permission.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accountConfig?.youtube?.connected ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CircleCheck className="size-4 text-green-500" />
                          Connected to{" "}
                          {accountConfig.youtube.channelTitle ?? "(unknown channel)"}
                        </div>
                        {accountConfig.youtube.channelId && (
                          <div className="text-xs text-muted-foreground">
                            channel id: {accountConfig.youtube.channelId}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          since{" "}
                          {new Date(accountConfig.youtube.connectedAt).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void disconnectYoutube()}
                      >
                        <Unplug className="size-4" /> Disconnect
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                      <div className="text-sm text-muted-foreground">
                        Not connected. Click connect to authorize YouTube uploads via Google.
                      </div>
                      <a
                        href={`/api/reposting/oauth/youtube/start?accountId=${activeAccount.id}`}
                      >
                        <Button size="sm">
                          <LinkIcon className="size-4" /> Connect YouTube
                        </Button>
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Heads up: YouTube&apos;s default API quota allows ~6 uploads/day per
                    Google project.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeAccount.flow === "yt-to-fb" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Flame className="size-4 text-orange-500" />
                    Viral Finder (YouTube)
                  </CardTitle>
                  <CardDescription>
                    Score-based discovery for short-form candidates (≤ 3 minutes), plus manual query mode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-md border p-3">
                    <div className="mb-3 text-sm font-medium">Niche profile</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <Label className="text-xs">Niche</Label>
                        <Input
                          placeholder="e.g. ai tools, football edits, travel hacks"
                          value={nicheDraft}
                          onChange={(e) => setNicheDraft(e.target.value)}
                          disabled={savingViralProfile || runningViral}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Audience</Label>
                        <Input
                          placeholder="e.g. students, beginners, gamers"
                          value={audienceDraft}
                          onChange={(e) => setAudienceDraft(e.target.value)}
                          disabled={savingViralProfile || runningViral}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Language</Label>
                        <Input
                          placeholder="e.g. english, bahasa"
                          value={languageDraft}
                          onChange={(e) => setLanguageDraft(e.target.value)}
                          disabled={savingViralProfile || runningViral}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Seed keywords (comma-separated)</Label>
                        <Input
                          placeholder="ai tools, productivity, money tips"
                          value={seedKeywordsDraft}
                          onChange={(e) => setSeedKeywordsDraft(e.target.value)}
                          disabled={savingViralProfile || runningViral}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Exclude keywords (comma-separated)</Label>
                        <Input
                          placeholder="politics, nsfw, controversy"
                          value={excludeKeywordsDraft}
                          onChange={(e) => setExcludeKeywordsDraft(e.target.value)}
                          disabled={savingViralProfile || runningViral}
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">Min viral score</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={minViralScoreDraft}
                            onChange={(e) =>
                              setMinViralScoreDraft(
                                Number.isFinite(Number(e.target.value))
                                  ? Number(e.target.value)
                                  : 65,
                              )
                            }
                            disabled={savingViralProfile || runningViral}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Auto-refresh (minutes)</Label>
                          <Input
                            type="number"
                            min={15}
                            max={1440}
                            value={autoRefreshMinutesDraft}
                            onChange={(e) =>
                              setAutoRefreshMinutesDraft(
                                Number.isFinite(Number(e.target.value))
                                  ? Number(e.target.value)
                                  : 360,
                              )
                            }
                            disabled={savingViralProfile || runningViral}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoRefreshEnabledDraft}
                          onChange={(e) => setAutoRefreshEnabledDraft(e.target.checked)}
                          disabled={savingViralProfile || runningViral}
                        />
                        Auto-refresh while this page is open
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoAppendEnabledDraft}
                          onChange={(e) => setAutoAppendEnabledDraft(e.target.checked)}
                          disabled={savingViralProfile || runningViral}
                        />
                        Auto-append top candidates after each viral run
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void saveViralProfile()}
                        disabled={savingViralProfile || runningViral}
                      >
                        {savingViralProfile ? "Saving…" : "Save viral profile"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_auto]">
                    <div>
                      <Label className="text-xs">Manual query</Label>
                      <Input
                        placeholder="e.g. ai tools, football clips, travel hacks"
                        value={discoverQuery}
                        onChange={(e) => setDiscoverQuery(e.target.value)}
                        disabled={discovering || runningViral}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max results</Label>
                      <Input
                        type="number"
                        min={1}
                        max={25}
                        value={discoverMaxResults}
                        onChange={(e) =>
                          setDiscoverMaxResults(
                            Number.isFinite(Number(e.target.value))
                              ? Number(e.target.value)
                              : 10,
                          )
                        }
                        disabled={discovering || runningViral}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Freshness (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={discoverFreshnessDays}
                        onChange={(e) =>
                          setDiscoverFreshnessDays(
                            Number.isFinite(Number(e.target.value))
                              ? Number(e.target.value)
                              : 7,
                          )
                        }
                        disabled={discovering || runningViral}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={() => void runDiscover()} disabled={discovering || runningViral}>
                        {discovering ? "Discovering…" : "Manual discover"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void runViralNow()}
                      disabled={runningViral || discovering}
                    >
                      <Flame className="size-4" /> {runningViral ? "Running…" : "Run viral finder"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void appendTopCandidates()}
                      disabled={appendingTop || runningViral || discovering || candidates.length === 0}
                    >
                      <Plus className="size-4" /> {appendingTop ? "Appending…" : "Append top to queue"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={appendSelectedCandidatesToQueue}
                      disabled={discovering || candidates.length === 0}
                    >
                      <Plus className="size-4" /> Append selected to queue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void refreshCandidates(activeAccount.id)}
                      disabled={discovering || discoverClearing || runningViral}
                    >
                      <RefreshCcw className="size-4" /> Refresh list
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void clearDiscover()}
                      disabled={discovering || discoverClearing || runningViral || candidates.length === 0}
                    >
                      {discoverClearing ? "Clearing…" : "Clear candidates"}
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_auto]">
                    <div className="text-xs text-muted-foreground">
                      Auto-refresh status:{" "}
                      {viralProfile?.autoRefreshEnabled
                        ? `ON (${viralProfile.autoRefreshMinutes}m interval, browser-session only)`
                        : "OFF"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Min viral score: {viralProfile?.minViralScore ?? minViralScoreDraft}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Auto-append: {viralProfile?.autoAppendEnabled ? "ON" : "OFF"}
                    </div>
                  </div>

                  {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No discovered candidates yet. Run Viral Finder or Manual Discover.
                    </p>
                  ) : (
                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {candidates.map((c) => (
                        <label
                          key={c.url}
                          className="flex items-start gap-3 rounded-md border p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(candidateSelection[c.url])}
                            onChange={(e) =>
                              setCandidateSelection((prev) => ({
                                ...prev,
                                [c.url]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate font-medium">{c.title || c.url}</div>
                              {typeof c.viralScore === "number" && (
                                <span
                                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                                  title={
                                    c.scoreBreakdown
                                      ? `velocity ${c.scoreBreakdown.velocity}, freshness ${c.scoreBreakdown.freshness}, engagement ${c.scoreBreakdown.engagement}, relevance ${c.scoreBreakdown.relevance}, feedback ${c.scoreBreakdown.feedback}`
                                      : "no breakdown"
                                  }
                                >
                                  Score {c.viralScore}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{c.channelTitle || "Unknown channel"}</span>
                              <span>·</span>
                              <span>{new Date(c.publishedAt).toLocaleDateString()}</span>
                              <span>·</span>
                              <span>{formatCount(c.viewCount)} views</span>
                              <span>·</span>
                              <span>{formatCount(c.likeCount)} likes</span>
                              <span>·</span>
                              <span>{Math.round(c.durationSeconds)}s</span>
                              {c.sourceQuery ? (
                                <>
                                  <span>·</span>
                                  <span>q: {c.sourceQuery}</span>
                                </>
                              ) : null}
                            </div>
                            {c.matchedKeywords && c.matchedKeywords.length > 0 ? (
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                matched: {c.matchedKeywords.join(", ")}
                              </div>
                            ) : null}
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block truncate text-xs text-muted-foreground underline"
                            >
                              {c.url}
                            </a>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeAccount.flow === "yt-to-fb" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-4 text-indigo-500" />
                    AI Copilot
                  </CardTitle>
                  <CardDescription>
                    Preflight captions with 3 variants, safety screening, and explicit approval before scheduling.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void runPreflight()}
                      disabled={runningPreflight || running || ytQueueUrls.length === 0}
                    >
                      <Sparkles className="size-4" />{" "}
                      {runningPreflight ? "Running preflight…" : "Run AI preflight"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void refreshPreflight(activeAccount.id)}
                      disabled={runningPreflight || running}
                    >
                      <RefreshCcw className="size-4" /> Refresh preflight
                    </Button>
                  </div>

                  {ytQueueUrls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add queue URLs first, then run AI preflight.
                    </p>
                  ) : (
                    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                      {ytQueueUrls.map((url) => {
                        const pf = preflightItems[url];
                        if (!pf) {
                          return (
                            <div key={url} className="rounded-md border p-3 text-sm">
                              <div className="font-medium">{url}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                No preflight record yet.
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={url} className="rounded-md border p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium">{pf.title || url}</div>
                                <div className="truncate text-xs text-muted-foreground">{url}</div>
                              </div>
                              <div className={`text-xs font-medium ${preflightStatusTone(pf.approvalStatus)}`}>
                                {pf.approvalStatus.toUpperCase()}
                              </div>
                            </div>

                            {pf.blockReasons.length > 0 && (
                              <div className="mt-2 flex items-start gap-1 text-xs text-red-600">
                                <ShieldAlert className="mt-0.5 size-3.5" />
                                <span>{pf.blockReasons.join(" • ")}</span>
                              </div>
                            )}

                            <div className="mt-2 space-y-2">
                              {pf.variants.map((variant) => {
                                const safety = pf.safetyByVariant[variant.id];
                                const selected = pf.selectedVariantId === variant.id;
                                return (
                                  <div
                                    key={variant.id}
                                    className={`rounded-md border p-2 ${
                                      selected ? "border-primary bg-primary/5" : "border-border"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-xs font-medium">
                                        {variant.hookType || "general"}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        risk: {safety?.riskLevel ?? "review"}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-xs">{variant.text}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant={selected ? "default" : "outline"}
                                        disabled={running || approvingPreflight === url}
                                        onClick={() =>
                                          void approvePreflight({
                                            url,
                                            variantId: variant.id,
                                          })
                                        }
                                      >
                                        {selected ? "Selected" : "Use + approve"}
                                      </Button>
                                      {(safety?.riskLevel === "review" ||
                                        safety?.riskLevel === "block") && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={running || approvingPreflight === url}
                                          onClick={() => {
                                            const reason = window.prompt(
                                              "Override reason (required):",
                                              "Relevant to niche and acceptable for our page policy",
                                            );
                                            if (!reason?.trim()) return;
                                            void approvePreflight({
                                              url,
                                              variantId: variant.id,
                                              overrideReason: reason,
                                            });
                                          }}
                                        >
                                          Override with reason
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeAccount.flow === "yt-to-fb" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="size-4 text-cyan-600" />
                    Weekly AI Coach
                  </CardTitle>
                  <CardDescription>
                    Rolling 7-day insights based on local reposting history and candidate metadata.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void refreshCoachNow()}
                      disabled={runningCoach || running}
                    >
                      <Brain className="size-4" />{" "}
                      {runningCoach ? "Refreshing…" : "Refresh insights"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void refreshCoach(activeAccount.id)}
                      disabled={runningCoach || running}
                    >
                      <RefreshCcw className="size-4" /> Load cached report
                    </Button>
                  </div>

                  {!coachReport ? (
                    <p className="text-sm text-muted-foreground">
                      No AI coach report yet. Click Refresh insights.
                    </p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div className="text-xs text-muted-foreground">
                        Window: {new Date(coachReport.windowStart).toLocaleString()} →{" "}
                        {new Date(coachReport.windowEnd).toLocaleString()} · generated{" "}
                        {new Date(coachReport.generatedAt).toLocaleString()}
                      </div>
                      <div className="grid gap-2 text-xs md:grid-cols-3">
                        <div className="rounded-md border p-2">
                          total {coachReport.metrics.total} · posted {coachReport.metrics.posted}
                        </div>
                        <div className="rounded-md border p-2">
                          failed {coachReport.metrics.failed} · scheduled {coachReport.metrics.scheduled}
                        </div>
                        <div className="rounded-md border p-2">
                          avg caption {coachReport.metrics.avgCaptionLength} chars · hashtags{" "}
                          {coachReport.metrics.avgHashtags}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium">Findings</div>
                        {coachReport.findings.map((line, i) => (
                          <div key={i} className="text-xs text-muted-foreground">
                            • {line}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium">Recommendations</div>
                        {coachReport.recommendations.map((line, i) => (
                          <div key={i} className="text-xs text-muted-foreground">
                            • {line}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium">Next 7-day playbook</div>
                        {coachReport.playbook.map((line, i) => (
                          <div key={i} className="text-xs text-muted-foreground">
                            • {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlowBadge flow={activeAccount.flow} />
                  Queue
                </CardTitle>
                <CardDescription>
                  {activeAccount.flow === "yt-to-fb"
                    ? "One YouTube Shorts URL per row. AI preflight approval is required before scheduling."
                    : activeAccount.flow === "tt-to-fb"
                      ? "One TikTok URL per row. Caption is optional — leave blank to auto-generate with AI."
                      : "One Instagram Reel URL per row (public reels only)."}{" "}
                  Scheduled time must be 11 minutes – 6 months from now.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="grid gap-2 md:grid-cols-[1fr_220px_auto_auto_auto] md:items-start"
                    >
                      <div>
                        <Label className="flex items-center gap-1 text-xs">
                          {activeAccount.flow === "yt-to-fb" ? (
                            <>
                              <YoutubeIcon size={12} className="text-[#ff0000]" /> YouTube URL
                            </>
                          ) : activeAccount.flow === "tt-to-fb" ? (
                            <>
                              <TiktokIcon size={12} /> TikTok URL
                            </>
                          ) : (
                            <>
                              <InstagramIcon size={12} className="text-[#e4405f]" /> Instagram Reel URL
                            </>
                          )}
                        </Label>
                        <Input
                          placeholder={
                            activeAccount.flow === "yt-to-fb"
                              ? "https://www.youtube.com/shorts/..."
                              : activeAccount.flow === "tt-to-fb"
                                ? "https://www.tiktok.com/@user/video/..."
                                : "https://www.instagram.com/reel/..."
                          }
                          value={item.url}
                          onChange={(e) => updateItem(i, { url: e.target.value })}
                          disabled={running}
                        />
                        {activeAccount.flow === "tt-to-fb" && (
                          <div className="mt-2">
                            <Label className="flex items-center justify-between gap-1 text-xs">
                              <span>Caption (optional)</span>
                              {item.caption && (
                                <button
                                  type="button"
                                  onClick={() => updateItem(i, { caption: "" })}
                                  disabled={running}
                                  className="text-[10px] text-muted-foreground underline"
                                >
                                  Use AI instead
                                </button>
                              )}
                            </Label>
                            <textarea
                              placeholder="Leave blank to auto-generate with AI"
                              value={item.caption ?? ""}
                              onChange={(e) => updateItem(i, { caption: e.target.value })}
                              disabled={running}
                              rows={2}
                              className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
                            />
                          </div>
                        )}
                        {(activeAccount.flow === "yt-to-fb" ||
                          activeAccount.flow === "tt-to-fb") && (
                          <div className="mt-2">
                            <Label className="text-xs">First comment (optional)</Label>
                            <textarea
                              placeholder="Posted as a comment under the video after upload (links, CTAs, hashtags…)"
                              value={item.comment ?? ""}
                              onChange={(e) => updateItem(i, { comment: e.target.value })}
                              disabled={running}
                              rows={2}
                              className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Scheduled at</Label>
                        <Input
                          type="datetime-local"
                          value={item.scheduledAt}
                          onChange={(e) => updateItem(i, { scheduledAt: e.target.value })}
                          disabled={running || item.publishNow}
                        />
                        <div className="mt-1 flex flex-wrap gap-1">
                          {[
                            { label: "+12h", minutes: 12 * 60 },
                            { label: "+1d", minutes: 24 * 60 },
                            { label: "+2d", minutes: 2 * 24 * 60 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                updateItem(i, {
                                  scheduledAt: defaultScheduledAt(preset.minutes),
                                  publishNow: false,
                                })
                              }
                              disabled={running}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 whitespace-nowrap text-sm md:mt-7">
                        <input
                          type="checkbox"
                          checked={item.publishNow}
                          onChange={(e) => updateItem(i, { publishNow: e.target.checked })}
                          disabled={running || downloading}
                        />
                        Post now
                      </label>
                      <Button
                        variant="outline"
                        size="icon"
                        className="md:mt-5"
                        onClick={() => void downloadRow(i)}
                        disabled={running || downloading || !item.url.trim()}
                        title={downloadingRow === i ? "Downloading…" : "Download this video"}
                      >
                        <Download
                          className={`size-4 ${downloadingRow === i ? "animate-pulse" : ""}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:mt-5"
                        onClick={() => removeRow(i)}
                        disabled={running || downloading}
                        title="Remove"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addRow}
                    disabled={running || downloading}
                  >
                    <Plus className="size-4" /> Add row
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadAll()}
                    disabled={running || downloading}
                  >
                    <Download className="size-4" />
                    {downloading ? "Downloading…" : "Download all"}
                  </Button>
                  <Button onClick={run} disabled={running || downloading}>
                    <Send className="size-4" /> {running ? "Running…" : "Schedule all"}
                  </Button>
                  {running && (
                    <Button variant="destructive" onClick={stopRun}>
                      <Square className="size-4" /> Stop
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {log.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                    {log.join("\n")}
                  </pre>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">History</CardTitle>
                <CardDescription>Scheduled and posted videos (most recent first)</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((r, i) => (
                      <div
                        key={i}
                        className={`rounded-md border p-3 text-xs ${r.status === "deleted" ? "opacity-60" : ""}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {r.status === "posted" ? (
                            <span className="flex items-center gap-1 font-medium text-green-500">
                              <CircleCheck className="size-4" /> Posted
                            </span>
                          ) : r.status === "scheduled" ? (
                            <span className="flex items-center gap-1 font-medium text-amber-500">
                              <Clock className="size-4" /> Scheduled
                            </span>
                          ) : r.status === "failed" ? (
                            <span className="flex items-center gap-1 font-medium text-red-500">
                              <CircleX className="size-4" /> Failed
                            </span>
                          ) : r.status === "deleted" ? (
                            <span className="flex items-center gap-1 font-medium text-red-500">
                              <CircleX className="size-4" /> Deleted
                            </span>
                          ) : (
                            <span className="font-medium capitalize">{r.status}</span>
                          )}
                          <span className="text-muted-foreground">
                            for {new Date(r.scheduledAt).toLocaleString()}
                          </span>
                          {r.publishedAt && (
                            <span className="text-muted-foreground">
                              · published {new Date(r.publishedAt).toLocaleString()}
                            </span>
                          )}
                          {r.deletedAt && (
                            <span className="text-muted-foreground">
                              · deleted {new Date(r.deletedAt).toLocaleString()}
                            </span>
                          )}
                          <span className="text-muted-foreground">· FB id {r.fbPostId}</span>
                        </div>
                        <div
                          className={`mt-1 truncate ${r.status === "deleted" ? "line-through" : ""}`}
                        >
                          {r.url}
                        </div>
                        <div
                          className={`mt-1 line-clamp-2 text-muted-foreground ${r.status === "deleted" ? "line-through" : ""}`}
                        >
                          {r.caption}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog open={nameDialog !== null} onOpenChange={(o) => !o && setNameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nameDialog?.mode === "rename" ? "Rename account" : "New reposting account"}
            </DialogTitle>
            <DialogDescription>
              {nameDialog?.mode === "rename"
                ? "Update the display name for this reposting account."
                : "Each account holds its own Facebook destination, token, and history."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {nameDialog?.mode === "create" && (
              <div className="space-y-2">
                <Label className="text-xs">Flow</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(["yt-to-fb", "ig-to-yt", "tt-to-fb"] as const).map((f) => {
                    const selected = nameDialog.flow === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() =>
                          setNameDialog((d) =>
                            d?.mode === "create" ? { ...d, flow: f } : d,
                          )
                        }
                        className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <FlowBadge flow={f} size={18} />
                        <span className="text-sm font-medium">{FLOW_LABELS[f]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                autoFocus
                value={nameDialog?.value ?? ""}
                onChange={(e) =>
                  setNameDialog((d) => (d ? { ...d, value: e.target.value } : d))
                }
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
            <Button variant="outline" onClick={() => setNameDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitNameDialog} disabled={!nameDialog?.value.trim()}>
              {nameDialog?.mode === "rename" ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogId !== null}
        onOpenChange={(o) => !o && setDeleteDialogId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const acc = accounts.find((a) => a.id === deleteDialogId);
                return `"${acc?.name ?? ""}" will be removed from the list. Its history is preserved on disk and can be recovered.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAccount}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch reposting account</DialogTitle>
            <DialogDescription>
              Pick which account to work with. Your queue, settings, and history reload to match.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
              [...accounts]
                .sort((a, b) =>
                  a.flow === b.flow
                    ? a.name.localeCompare(b.name)
                    : a.flow.localeCompare(b.flow),
                )
                .map((a) => {
                  const isActive = a.id === activeId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setActiveId(a.id);
                        setSwitchOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40 hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FlowBadge flow={a.flow} size={16} />
                        <div>
                          <div className="text-sm font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {FLOW_LABELS[a.flow]}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-[10px] uppercase tracking-wider text-primary">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setSwitchOpen(false);
                openCreateDialog();
              }}
            >
              <Plus className="size-4" /> Add Account
            </Button>
            <Button variant="ghost" onClick={() => setSwitchOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
