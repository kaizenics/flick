"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
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
import { ArrowRight, Flame, Plus, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
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

const blankRow = (offset = 20): QueueItem => ({
  url: "",
  scheduledAt: defaultScheduledAt(offset),
  publishNow: false,
});

export function ScrapingPanel() {
  const [accounts, setAccounts] = useState<RepostingAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [nameDialog, setNameDialog] = useState<{ value: string; flow: Flow } | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
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

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-2">
          <Search className="size-4" />
          <h1 className="text-sm font-medium">Scraping</h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {activeAccount ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-xs">
              <FlowBadge flow={activeAccount.flow} />
              <span className="font-medium">{activeAccount.name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No account selected</span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSwitchOpen(true)}
            disabled={accounts.length === 0}
          >
            <ArrowRight className="size-4" /> Switch account
          </Button>
          <Button size="sm" variant="outline" onClick={openCreateDialog}>
            <Plus className="size-4" /> Add Account
          </Button>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-6">
        {!activeAccount ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No reposting account yet</CardTitle>
              <CardDescription>
                Create an account to start running discovery and viral scraping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={openCreateDialog}>
                <Plus className="size-4" /> Add account
              </Button>
            </CardContent>
          </Card>
        ) : activeAccount.flow !== "yt-to-fb" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unsupported flow for Scraping</CardTitle>
              <CardDescription>
                Scraping currently supports only <strong>YouTube → Facebook</strong> accounts.
                Switch to a `yt-to-fb` account or create one.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSwitchOpen(true)}>
                <ArrowRight className="size-4" /> Switch account
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="size-4" /> Add `yt-to-fb` account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="size-4 text-orange-500" />
                Viral Finder (YouTube)
              </CardTitle>
              <CardDescription>
                Score-based discovery for short-form candidates (≤ 3 minutes), plus manual query mode.
                Append actions write into this account&apos;s existing Reposting queue.
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
                        Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 10,
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
                        Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 7,
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
                    <label key={c.url} className="flex items-start gap-3 rounded-md border p-3 text-sm">
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
      </main>

      <Dialog open={nameDialog !== null} onOpenChange={(o) => !o && setNameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New scraping account</DialogTitle>
            <DialogDescription>
              Each account has its own queue, discovery candidates, and viral profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Flow</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["yt-to-fb", "ig-to-yt", "tt-to-fb"] as const).map((f) => {
                  const selected = nameDialog?.flow === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setNameDialog((d) => (d ? { ...d, flow: f } : d))
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
            <div className="space-y-2">
              <Label htmlFor="scraping-account-name">Account name</Label>
              <Input
                id="scraping-account-name"
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
            <Button onClick={submitNameDialog} disabled={creating || !nameDialog?.value.trim()}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch scraping account</DialogTitle>
            <DialogDescription>
              Pick which account to use for discovery. Queue-aware append will use this account.
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
                          <div className="text-xs text-muted-foreground">{FLOW_LABELS[a.flow]}</div>
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
