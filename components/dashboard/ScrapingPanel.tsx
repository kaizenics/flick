"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Check,
  ChevronsUpDown,
  Flame,
  ListPlus,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import {
  YoutubeIcon,
  InstagramIcon,
  FacebookIcon,
  TiktokIcon,
} from "@/components/icons/brand";

type Flow = "yt-to-fb" | "ig-to-yt" | "tt-to-fb";

type RepostingAccount = {
  id: string;
  name: string;
  flow: Flow;
  createdAt: string;
};

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

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
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

const blankRow = (offset = 20): QueueItem => ({
  url: "",
  scheduledAt: defaultScheduledAt(offset),
  publishNow: false,
});

export function ScrapingPanel() {
  const [accounts, setAccounts] = useState<RepostingAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [nameDialog, setNameDialog] = useState<{ value: string; flow: Flow } | null>(null);
  const [creating, setCreating] = useState(false);

  const [items, setItems] = useState<QueueItem[]>([blankRow()]);
  const [history, setHistory] = useState<ScheduledRecord[]>([]);

  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [candidateSelection, setCandidateSelection] = useState<Record<string, boolean>>({});
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverMaxResults, setDiscoverMaxResults] = useState(10);
  const [discoverFreshnessDays, setDiscoverFreshnessDays] = useState(7);
  const [discovering, setDiscovering] = useState(false);
  const [discoverClearing, setDiscoverClearing] = useState(false);

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

  const activeAccount = accounts.find((a) => a.id === activeId) ?? null;

  const applyViralProfileDrafts = (profile: ViralProfile | null) => {
    setViralProfile(profile);
    if (!profile) {
      setNicheDraft("");
      setAudienceDraft("");
      setLanguageDraft("");
      setSeedKeywordsDraft("");
      setExcludeKeywordsDraft("");
      setAutoRefreshEnabledDraft(false);
      setAutoRefreshMinutesDraft(360);
      setMinViralScoreDraft(65);
      setAutoAppendEnabledDraft(false);
      return;
    }
    setNicheDraft(profile.niche);
    setAudienceDraft(profile.audience);
    setLanguageDraft(profile.language);
    setSeedKeywordsDraft(stringifyKeywordList(profile.seedKeywords));
    setExcludeKeywordsDraft(stringifyKeywordList(profile.excludeKeywords));
    setAutoRefreshEnabledDraft(profile.autoRefreshEnabled);
    setAutoRefreshMinutesDraft(profile.autoRefreshMinutes);
    setMinViralScoreDraft(profile.minViralScore);
    setAutoAppendEnabledDraft(profile.autoAppendEnabled);
  };

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
      value: `Account ${accounts.length + 1}`,
      flow: "yt-to-fb",
    });
  };

  const submitNameDialog = async () => {
    if (!nameDialog) return;
    const name = nameDialog.value.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/reposting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, flow: nameDialog.flow }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as RepostingAccount;
      await refreshAccounts(created.id);
      setNameDialog(null);
      toast.success(`Created "${created.name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
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

  const refreshViralProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/reposting/accounts/${id}/discover/viral-profile`);
      if (!res.ok) {
        applyViralProfileDrafts(null);
        return;
      }
      const data = (await res.json()) as ViralProfile;
      applyViralProfileDrafts(data);
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
      applyViralProfileDrafts(data);
      toast.success("Viral profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingViralProfile(false);
    }
  };

  const runDiscover = async () => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
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
      toast.success(`Discover complete: ${data.added ?? 0} new, ${data.updated ?? 0} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discover failed");
    } finally {
      setDiscovering(false);
    }
  };

  const clearDiscover = async () => {
    if (!activeId || !activeAccount || activeAccount.flow !== "yt-to-fb") return;
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

  useEffect(() => {
    void refreshAccounts();
  }, []);

  useEffect(() => {
    if (!activeId) {
      setHistory([]);
      setItems([blankRow()]);
      setCandidates([]);
      setCandidateSelection({});
      applyViralProfileDrafts(null);
      return;
    }

    localStorage.setItem("reposting:activeId", activeId);
    void refreshHistory(activeId);
    void refreshCandidates(activeId);
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
    if (runningViral || appendingTop) return;
    void runViralNow({ silent: true });
  }, [
    autoCycleTick,
    activeId,
    activeAccount,
    viralProfile?.autoRefreshEnabled,
    runningViral,
    appendingTop,
  ]);

  const isYt = activeAccount?.flow === "yt-to-fb";
  const busy = discovering || runningViral;
  const minScore = viralProfile?.minViralScore ?? minViralScoreDraft;
  const selectedCount = candidates.filter((c) => candidateSelection[c.url]).length;
  const aboveMin = candidates.filter((c) => (c.viralScore ?? -1) >= minScore).length;
  const queuedCount = items.filter((it) => it.url.trim()).length;
  const allSelected = candidates.length > 0 && selectedCount === candidates.length;
  const profileDisabled = savingViralProfile || runningViral;
  const numInput = (v: string, fallback: number) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;

  return (
    <>
      <AppTopbar title="Scraping" icon={Search}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="max-w-[16rem] text-white" disabled={runningViral} />}
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
        {!activeAccount || !isYt ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold">Viral finder</h1>
              <p className="text-sm text-muted-foreground">
                {!activeAccount
                  ? "No reposting account yet. Discovery fills an account's queue, so create one first."
                  : `${activeAccount.name} is ${FLOW_LABELS[activeAccount.flow]}. Scraping only works with YouTube → Facebook accounts.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setNameDialog({ value: `Account ${accounts.length + 1}`, flow: "yt-to-fb" })}
              >
                <Plus data-icon="inline-start" /> New YouTube → Facebook account
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <h1 className="text-xl font-semibold">Viral finder</h1>
                <p className="text-sm text-muted-foreground">
                  {candidates.length === 0 ? (
                    "No candidates yet. Run the finder to score fresh shorts against this niche."
                  ) : (
                    <>
                      <span className="num">{candidates.length}</span> candidates,{" "}
                      <span className="num">{aboveMin}</span> at or above score{" "}
                      <span className="num">{minScore}</span>. Queue holds{" "}
                      <span className="num">{queuedCount}</span> links.
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void appendTopCandidates()}
                  disabled={appendingTop || busy || candidates.length === 0}
                >
                  {appendingTop ? (
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <ListPlus data-icon="inline-start" />
                  )}
                  {appendingTop ? "Sending…" : "Send top to queue"}
                </Button>
                <Button onClick={() => void runViralNow()} disabled={busy}>
                  {runningViral ? (
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <Flame data-icon="inline-start" />
                  )}
                  {runningViral ? "Finding…" : "Run viral finder"}
                </Button>
              </div>
            </div>

            <Tabs defaultValue="candidates" className="gap-6">
              <div className="-mx-4 overflow-x-auto border-b border-border px-4 md:-mx-7 md:px-7">
                <TabsList variant="line" className="h-10 gap-5 p-0">
                  <TabsTrigger value="candidates" className="flex-none px-0">
                    Candidates
                    <span className="num text-muted-foreground">{candidates.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="profile" className="flex-none px-0">
                    Niche profile
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ---------------- Candidates ---------------- */}
              <TabsContent value="candidates" className="flex flex-col gap-3.5">
                <form
                  className="flex flex-col gap-3 rounded-[20px] bg-card p-5 md:flex-row md:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runDiscover();
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor="discover-query">Search a query instead</Label>
                    <Input
                      id="discover-query"
                      placeholder="e.g. ai tools, football clips, travel hacks"
                      value={discoverQuery}
                      onChange={(e) => setDiscoverQuery(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex w-28 flex-col gap-2">
                      <Label htmlFor="discover-max">Max results</Label>
                      <Input
                        id="discover-max"
                        type="number"
                        min={1}
                        max={25}
                        className="num"
                        value={discoverMaxResults}
                        onChange={(e) => setDiscoverMaxResults(numInput(e.target.value, 10))}
                        disabled={busy}
                      />
                    </div>
                    <div className="flex w-28 flex-col gap-2">
                      <Label htmlFor="discover-fresh">Within days</Label>
                      <Input
                        id="discover-fresh"
                        type="number"
                        min={1}
                        max={365}
                        className="num"
                        value={discoverFreshnessDays}
                        onChange={(e) => setDiscoverFreshnessDays(numInput(e.target.value, 7))}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="outline" disabled={busy}>
                    {discovering ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <Search data-icon="inline-start" />
                    )}
                    {discovering ? "Searching…" : "Search"}
                  </Button>
                </form>

                <div className="flex flex-col rounded-[20px] bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <h2 className="text-base font-medium">
                        Candidates{" "}
                        <span className="num font-normal text-muted-foreground">{candidates.length}</span>
                      </h2>
                      <p className="text-xs text-faint">
                        Shorts up to 3 minutes. Auto-refresh{" "}
                        {viralProfile?.autoRefreshEnabled
                          ? `every ${viralProfile.autoRefreshMinutes} min while this page is open`
                          : "off"}
                        , auto-send {viralProfile?.autoAppendEnabled ? "on" : "off"}.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={appendSelectedCandidatesToQueue}
                        disabled={discovering || selectedCount === 0}
                      >
                        <Plus data-icon="inline-start" />
                        Add selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void refreshCandidates(activeAccount.id)}
                        disabled={discovering || discoverClearing || runningViral}
                      >
                        <RefreshCcw data-icon="inline-start" /> Refresh
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void clearDiscover()}
                        disabled={discovering || discoverClearing || runningViral || candidates.length === 0}
                      >
                        <Trash2 data-icon="inline-start" />
                        {discoverClearing ? "Clearing…" : "Clear"}
                      </Button>
                    </div>
                  </div>

                  {candidates.length === 0 ? (
                    <p className="border-t border-border px-5 py-6 text-sm text-faint">
                      {busy
                        ? "Searching YouTube…"
                        : "Nothing found yet. Run viral finder for the niche profile, or search a query above."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[820px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-faint">
                            <th className="w-10 py-2.5 pl-5 font-normal">
                              <input
                                type="checkbox"
                                aria-label="Select all candidates"
                                className="size-4 cursor-pointer accent-white align-middle"
                                checked={allSelected}
                                onChange={(e) =>
                                  setCandidateSelection(
                                    e.target.checked
                                      ? Object.fromEntries(candidates.map((c) => [c.url, true]))
                                      : {},
                                  )
                                }
                              />
                            </th>
                            <th className="px-3 py-2.5 font-normal">Video</th>
                            <th className="px-3 py-2.5 text-right font-normal">Score</th>
                            <th className="px-3 py-2.5 text-right font-normal">Views</th>
                            <th className="px-3 py-2.5 text-right font-normal">Likes</th>
                            <th className="px-3 py-2.5 text-right font-normal">Length</th>
                            <th className="py-2.5 pr-5 pl-3 text-right font-normal">Published</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidates.map((c) => {
                            const thumb = c.videoId
                              ? `https://i.ytimg.com/vi/${c.videoId}/mqdefault.jpg`
                              : c.thumbUrl;
                            const checked = Boolean(candidateSelection[c.url]);
                            return (
                              <tr
                                key={c.url}
                                className={cn("border-t border-border align-middle", checked && "bg-raised/40")}
                              >
                                <td className="py-3 pl-5">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${c.title || c.url}`}
                                    className="size-4 cursor-pointer accent-white align-middle"
                                    checked={checked}
                                    onChange={(e) =>
                                      setCandidateSelection((prev) => ({
                                        ...prev,
                                        [c.url]: e.target.checked,
                                      }))
                                    }
                                  />
                                </td>
                                <td className="max-w-0 px-3 py-3">
                                  <div className="flex items-center gap-3">
                                    <a
                                      href={c.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-raised"
                                    >
                                      {thumb ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
                                      ) : (
                                        <YoutubeIcon size={18} className="text-faint" />
                                      )}
                                    </a>
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                      <a
                                        href={c.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate font-medium hover:underline"
                                        title={c.title || c.url}
                                      >
                                        {c.title || c.url}
                                      </a>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {c.channelTitle || "Unknown channel"}
                                        {c.sourceQuery ? ` · from “${c.sourceQuery}”` : ""}
                                      </span>
                                      {c.matchedKeywords && c.matchedKeywords.length > 0 && (
                                        <span className="truncate text-xs text-faint">
                                          Matches {c.matchedKeywords.join(", ")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td
                                  className={cn(
                                    "num px-3 py-3 text-right font-medium",
                                    typeof c.viralScore === "number" && c.viralScore >= minScore
                                      ? "text-data"
                                      : "text-muted-foreground",
                                  )}
                                  title={
                                    c.scoreBreakdown
                                      ? `Velocity ${c.scoreBreakdown.velocity}, freshness ${c.scoreBreakdown.freshness}, engagement ${c.scoreBreakdown.engagement}, relevance ${c.scoreBreakdown.relevance}, feedback ${c.scoreBreakdown.feedback}`
                                      : "No breakdown"
                                  }
                                >
                                  {typeof c.viralScore === "number" ? c.viralScore : "—"}
                                </td>
                                <td className="num px-3 py-3 text-right">{c.viewCount.toLocaleString()}</td>
                                <td className="num px-3 py-3 text-right text-muted-foreground">
                                  {c.likeCount.toLocaleString()}
                                </td>
                                <td className="num px-3 py-3 text-right text-muted-foreground">
                                  {formatDuration(c.durationSeconds)}
                                </td>
                                <td className="num py-3 pr-5 pl-3 text-right whitespace-nowrap text-muted-foreground">
                                  {c.publishedAt
                                    ? new Date(c.publishedAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ---------------- Niche profile ---------------- */}
              <TabsContent value="profile" className="flex flex-col">
                <SettingsRow
                  title="Niche"
                  description="Who this account posts for. The finder builds its queries from these."
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vp-niche">Niche</Label>
                      <Input
                        id="vp-niche"
                        placeholder="ai tools, football edits"
                        value={nicheDraft}
                        onChange={(e) => setNicheDraft(e.target.value)}
                        disabled={profileDisabled}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vp-audience">Audience</Label>
                      <Input
                        id="vp-audience"
                        placeholder="students, gamers"
                        value={audienceDraft}
                        onChange={(e) => setAudienceDraft(e.target.value)}
                        disabled={profileDisabled}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vp-language">Language</Label>
                      <Input
                        id="vp-language"
                        placeholder="english, bahasa"
                        value={languageDraft}
                        onChange={(e) => setLanguageDraft(e.target.value)}
                        disabled={profileDisabled}
                      />
                    </div>
                  </div>
                </SettingsRow>
                <SettingsRow
                  title="Keywords"
                  description="Comma-separated. Seeds raise relevance; excluded words drop a video."
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vp-seed">Seed keywords</Label>
                    <Input
                      id="vp-seed"
                      placeholder="ai tools, productivity, money tips"
                      value={seedKeywordsDraft}
                      onChange={(e) => setSeedKeywordsDraft(e.target.value)}
                      disabled={profileDisabled}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vp-exclude">Exclude keywords</Label>
                    <Input
                      id="vp-exclude"
                      placeholder="politics, nsfw, controversy"
                      value={excludeKeywordsDraft}
                      onChange={(e) => setExcludeKeywordsDraft(e.target.value)}
                      disabled={profileDisabled}
                    />
                  </div>
                </SettingsRow>
                <SettingsRow
                  title="Automation"
                  description="Auto-refresh runs in this browser tab only. Send top respects the daily cap and the minimum score."
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vp-min">Minimum viral score</Label>
                    <Input
                      id="vp-min"
                      type="number"
                      min={0}
                      max={100}
                      className="num w-28"
                      value={minViralScoreDraft}
                      onChange={(e) => setMinViralScoreDraft(numInput(e.target.value, 65))}
                      disabled={profileDisabled}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                      <Switch
                        checked={autoRefreshEnabledDraft}
                        onCheckedChange={setAutoRefreshEnabledDraft}
                        disabled={profileDisabled}
                      />
                      Auto-refresh while this page is open
                    </label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Every
                      <Input
                        aria-label="Auto-refresh interval in minutes"
                        type="number"
                        min={15}
                        max={1440}
                        className="num w-24"
                        value={autoRefreshMinutesDraft}
                        onChange={(e) => setAutoRefreshMinutesDraft(numInput(e.target.value, 360))}
                        disabled={profileDisabled}
                      />
                      min
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 border-t border-border pt-5 text-sm">
                    <Switch
                      checked={autoAppendEnabledDraft}
                      onCheckedChange={setAutoAppendEnabledDraft}
                      disabled={profileDisabled}
                    />
                    Send top candidates to the queue after each run
                  </label>
                </SettingsRow>
                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => void saveViralProfile()} disabled={profileDisabled}>
                    {savingViralProfile && <Loader2 data-icon="inline-start" className="animate-spin" />}
                    {savingViralProfile ? "Saving…" : "Save profile"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={nameDialog !== null} onOpenChange={(o) => !o && setNameDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New reposting account</DialogTitle>
            <DialogDescription>
              Each account has its own queue, discovery candidates and niche profile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Flow">
              <Label>Pipe</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["yt-to-fb", "tt-to-fb", "ig-to-yt"] as const).map((f) => {
                  const selected = nameDialog?.flow === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setNameDialog((d) => (d ? { ...d, flow: f } : d))}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="scraping-account-name">Account name</Label>
              <Input
                id="scraping-account-name"
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
            <Button variant="outline" onClick={() => setNameDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitNameDialog} disabled={creating || !nameDialog?.value.trim()}>
              {creating ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
