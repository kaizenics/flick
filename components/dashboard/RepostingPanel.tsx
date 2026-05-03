"use client";

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
} from "lucide-react";
import { toast } from "sonner";

type ConfigField = { set: boolean; value: string | null; masked: string | null };
type ModelField = { set: boolean; value: string | null };
type MaskedConfig = {
  youtubeApiKey: ConfigField;
  openrouterApiKey: ConfigField;
  openrouterModel: ModelField;
  fbPageAccessToken: ConfigField;
};

type QueueItem = {
  url: string;
  scheduledAt: string;
  publishNow: boolean;
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
  error?: string;
};

function defaultScheduledAt(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RepostingPanel() {
  const [pageId, setPageId] = useState("");
  const [items, setItems] = useState<QueueItem[]>([
    { url: "", scheduledAt: defaultScheduledAt(20), publishNow: false },
  ]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [history, setHistory] = useState<ScheduledRecord[]>([]);
  const [config, setConfig] = useState<MaskedConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [youtubeKeyDraft, setYoutubeKeyDraft] = useState("");
  const [openrouterKeyDraft, setOpenrouterKeyDraft] = useState("");
  const [openrouterModelDraft, setOpenrouterModelDraft] = useState("");
  const [fbTokenDraft, setFbTokenDraft] = useState("");
  const [showYoutube, setShowYoutube] = useState(false);
  const [showOpenrouter, setShowOpenrouter] = useState(false);
  const [showFb, setShowFb] = useState(false);

  const refreshHistory = async () => {
    try {
      const res = await fetch("/api/reposting/schedule");
      if (!res.ok) return;
      const data = (await res.json()) as { records: ScheduledRecord[] };
      setHistory([...data.records].reverse());
    } catch {
      // ignore
    }
  };

  const pollPublishStatus = async () => {
    try {
      const res = await fetch("/api/reposting/schedule/refresh", { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { records: ScheduledRecord[] };
      setHistory([...data.records].reverse());
    } catch {
      // ignore
    }
  };

  const refreshConfig = async () => {
    try {
      const res = await fetch("/api/reposting/config");
      if (!res.ok) return;
      const data = (await res.json()) as MaskedConfig;
      setConfig(data);
      setYoutubeKeyDraft(data.youtubeApiKey.value ?? "");
      setOpenrouterKeyDraft(data.openrouterApiKey.value ?? "");
      setOpenrouterModelDraft(data.openrouterModel.value ?? "");
      setFbTokenDraft(data.fbPageAccessToken.value ?? "");
    } catch {
      // ignore
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const body: Record<string, string> = {};
      const ytCurrent = config?.youtubeApiKey.value ?? "";
      const orCurrent = config?.openrouterApiKey.value ?? "";
      const fbCurrent = config?.fbPageAccessToken.value ?? "";
      const modelCurrent = config?.openrouterModel.value ?? "";
      if (youtubeKeyDraft !== ytCurrent) body.youtubeApiKey = youtubeKeyDraft;
      if (openrouterKeyDraft !== orCurrent) body.openrouterApiKey = openrouterKeyDraft;
      if (openrouterModelDraft !== modelCurrent) body.openrouterModel = openrouterModelDraft;
      if (fbTokenDraft !== fbCurrent) body.fbPageAccessToken = fbTokenDraft;
      if (Object.keys(body).length === 0) {
        toast.info("Nothing changed");
        return;
      }
      const res = await fetch("/api/reposting/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as MaskedConfig;
      setConfig(data);
      setYoutubeKeyDraft(data.youtubeApiKey.value ?? "");
      setOpenrouterKeyDraft(data.openrouterApiKey.value ?? "");
      setOpenrouterModelDraft(data.openrouterModel.value ?? "");
      setFbTokenDraft(data.fbPageAccessToken.value ?? "");
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingConfig(false);
    }
  };

  const clearKey = async (
    field: "youtubeApiKey" | "openrouterApiKey" | "openrouterModel" | "fbPageAccessToken",
  ) => {
    try {
      const res = await fetch("/api/reposting/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as MaskedConfig;
      setConfig(data);
      if (field === "youtubeApiKey") setYoutubeKeyDraft("");
      if (field === "openrouterApiKey") setOpenrouterKeyDraft("");
      if (field === "openrouterModel") setOpenrouterModelDraft("");
      if (field === "fbPageAccessToken") setFbTokenDraft("");
      toast.success("Cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    }
  };

  useEffect(() => {
    void refreshHistory();
    void refreshConfig();
    const savedPageId = localStorage.getItem("reposting:pageId");
    if (savedPageId) setPageId(savedPageId);
    const savedQueue = localStorage.getItem("reposting:queue");
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue) as QueueItem[];
        if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
      } catch {
        // ignore corrupt state
      }
    }
    void pollPublishStatus();
    const interval = setInterval(() => void pollPublishStatus(), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pageId) localStorage.setItem("reposting:pageId", pageId);
    else localStorage.removeItem("reposting:pageId");
  }, [pageId]);

  useEffect(() => {
    localStorage.setItem("reposting:queue", JSON.stringify(items));
  }, [items]);

  const append = (line: string) => setLog((l) => [...l, line]);

  const updateItem = (i: number, patch: Partial<QueueItem>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const addRow = () =>
    setItems((arr) => [
      ...arr,
      { url: "", scheduledAt: defaultScheduledAt(20 + arr.length * 60), publishNow: false },
    ]);
  const removeRow = (i: number) =>
    setItems((arr) => {
      const next = arr.filter((_, idx) => idx !== i);
      return next.length === 0
        ? [{ url: "", scheduledAt: defaultScheduledAt(20), publishNow: false }]
        : next;
    });

  const run = async () => {
    if (!pageId.trim()) {
      toast.error("Enter a Facebook Page ID");
      return;
    }
    const valid = items.filter((it) => it.url.trim().length > 0);
    if (valid.length === 0) {
      toast.error("Add at least one YouTube URL");
      return;
    }

    setLog([]);
    setRunning(true);
    append(`Submitting ${valid.length} item(s)…`);

    try {
      const res = await fetch("/api/reposting/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, items: valid }),
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
      toast.success("Pipeline finished");
      await refreshHistory();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      append(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <Repeat2 className="size-4" />
          <h1 className="text-sm font-medium">Reposting</h1>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">YouTube → Facebook Reposter</h2>
          <p className="text-sm text-muted-foreground">
            Queue YouTube Shorts URLs with a scheduled date/time. AI writes the caption; Facebook
            handles publishing at the scheduled moment.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Settings
            </CardTitle>
            <CardDescription>
              API keys are stored server-side in <code>data/reposting-config.json</code>. Saved
              values are masked; leave a field blank to keep its current value.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">YouTube API key</Label>
                <div className="relative">
                  <Input
                    type={showYoutube ? "text" : "password"}
                    placeholder={config?.youtubeApiKey.set ? config.youtubeApiKey.masked ?? "" : "AIza…"}
                    value={youtubeKeyDraft}
                    onChange={(e) => setYoutubeKeyDraft(e.target.value)}
                    disabled={savingConfig}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowYoutube((v) => !v)}
                    tabIndex={-1}
                    aria-label={showYoutube ? "Hide" : "Show"}
                  >
                    {showYoutube ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {config?.youtubeApiKey.set && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => clearKey("youtubeApiKey")}
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
                      config?.openrouterApiKey.set ? config.openrouterApiKey.masked ?? "" : "sk-or-v1-…"
                    }
                    value={openrouterKeyDraft}
                    onChange={(e) => setOpenrouterKeyDraft(e.target.value)}
                    disabled={savingConfig}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowOpenrouter((v) => !v)}
                    tabIndex={-1}
                    aria-label={showOpenrouter ? "Hide" : "Show"}
                  >
                    {showOpenrouter ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {config?.openrouterApiKey.set && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => clearKey("openrouterApiKey")}
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
                    config?.openrouterModel.set
                      ? config.openrouterModel.value ?? ""
                      : "anthropic/claude-haiku-4.5"
                  }
                  value={openrouterModelDraft}
                  onChange={(e) => setOpenrouterModelDraft(e.target.value)}
                  disabled={savingConfig}
                />
                {config?.openrouterModel.set && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => clearKey("openrouterModel")}
                  >
                    Clear (revert to default)
                  </button>
                )}
              </div>
              <div>
                <Label className="text-xs">Facebook Page Access Token</Label>
                <div className="relative">
                  <Input
                    type={showFb ? "text" : "password"}
                    placeholder={
                      config?.fbPageAccessToken.set ? config.fbPageAccessToken.masked ?? "" : "EAAG…"
                    }
                    value={fbTokenDraft}
                    onChange={(e) => setFbTokenDraft(e.target.value)}
                    disabled={savingConfig}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowFb((v) => !v)}
                    tabIndex={-1}
                    aria-label={showFb ? "Hide" : "Show"}
                  >
                    {showFb ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {config?.fbPageAccessToken.set && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => clearKey("fbPageAccessToken")}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <Button onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? "Saving…" : "Save settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Destination</CardTitle>
            <CardDescription>
              Facebook Page ID (from Graph API Explorer → me/accounts)
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-md">
            <Label htmlFor="page">Page ID</Label>
            <Input
              id="page"
              placeholder="1234567890"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              disabled={running}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Queue</CardTitle>
            <CardDescription>
              One YouTube Shorts URL per row. Scheduled time must be 11 minutes – 6 months from now.
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
                  <Label className="text-xs">YouTube URL</Label>
                  <Input
                    placeholder="https://www.youtube.com/shorts/..."
                    value={item.url}
                    onChange={(e) => updateItem(i, { url: e.target.value })}
                    disabled={running}
                  />
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
                  <div key={i} className="rounded-md border p-3 text-xs">
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
                      <span className="text-muted-foreground">· FB id {r.fbPostId}</span>
                    </div>
                    <div className="mt-1 truncate">{r.url}</div>
                    <div className="mt-1 line-clamp-2 text-muted-foreground">{r.caption}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
