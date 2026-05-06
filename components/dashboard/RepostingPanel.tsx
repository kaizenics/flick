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

function defaultScheduledAt(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const runAbortRef = useRef<AbortController | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [history, setHistory] = useState<ScheduledRecord[]>([]);

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

  // ---- queue ops ----
  const updateItem = (i: number, patch: Partial<QueueItem>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const addRow = () =>
    setItems((arr) => [...arr, blankRow(20 + arr.length * 60)]);
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
    const valid = items.filter((it) => it.url.trim().length > 0);
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
      setPageId("");
      setFbTokenDraft("");
      return;
    }
    localStorage.setItem("reposting:activeId", activeId);
    void refreshAccountConfig(activeId);
    void refreshHistory(activeId);
    void pollPublishStatus(activeId);
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

  const activeAccount = accounts.find((a) => a.id === activeId) ?? null;

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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlowBadge flow={activeAccount.flow} />
                  Queue
                </CardTitle>
                <CardDescription>
                  {activeAccount.flow === "yt-to-fb"
                    ? "One YouTube Shorts URL per row."
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
                      className="grid gap-2 md:grid-cols-[1fr_220px_auto_auto] md:items-start"
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
                          disabled={running}
                        />
                        Post now
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:mt-5"
                        onClick={() => removeRow(i)}
                        disabled={running}
                        title="Remove"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={addRow} disabled={running}>
                    <Plus className="size-4" /> Add row
                  </Button>
                  <Button onClick={run} disabled={running}>
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
