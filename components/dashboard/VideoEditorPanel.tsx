"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronsUpDown,
  Clapperboard,
  Download,
  Film,
  Loader2,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  StepBack,
  StepForward,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
} from "lucide-react";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  BlurFilter,
  EditTimeline,
  RenderResult,
  Segment,
  VideoEditorProjectSummary as ProjectSummary,
  VideoEditorProjectWithRefs,
} from "@/lib/video-editor/types";

type Project = Omit<VideoEditorProjectWithRefs, "lastRender"> & {
  lastRender: (RenderResult & { downloadUrl?: string }) | null;
};

const MIN_GAP = 0.05;
const HISTORY_LIMIT = 100;
const TRACK_PAD = 16;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function toMb(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// mm:ss.ff where ff is the frame inside the second.
function fmtTC(t: number, fps: number): string {
  const f = Math.max(1, Math.round(fps));
  const frames = Math.max(0, Math.round((Number.isFinite(t) ? t : 0) * f));
  const s = Math.floor(frames / f);
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}.${pad2(frames % f)}`;
}

// Accepts mm:ss.ff or plain seconds. Returns null when unreadable.
function parseTC(input: string, fps: number): number | null {
  const str = input.trim();
  if (!str) return null;
  if (!str.includes(":")) {
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }
  const [mm, rest = "0"] = str.split(":");
  const [ss, ff = "0"] = rest.split(".");
  const m = Number(mm);
  const s = Number(ss);
  const f = Number(ff);
  if (![m, s, f].every(Number.isFinite)) return null;
  return m * 60 + s + f / Math.max(1, Math.round(fps));
}

const segLen = (s: Segment) => s.end - s.start;

// Output time is the edited timeline with gaps closed; source time is the position in the original file.
function srcToOut(segments: Segment[], t: number): number {
  let offset = 0;
  for (const s of segments) {
    if (t < s.start) return offset;
    if (t <= s.end) return offset + (t - s.start);
    offset += segLen(s);
  }
  return offset;
}

function outToSrc(segments: Segment[], o: number): number {
  let offset = 0;
  for (const s of segments) {
    if (o <= offset + segLen(s)) return s.start + Math.max(0, o - offset);
    offset += segLen(s);
  }
  return segments.at(-1)?.end ?? 0;
}

const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

// Frames grabbed from the source at even intervals, drawn into a canvas, for the timeline filmstrip.
function useFilmstrip(src: string | null, duration: number, aspect: number): string[] {
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    setThumbs([]);
    if (!src || !(duration > 0)) return;
    let cancelled = false;
    const count = clamp(Math.ceil(duration / 2), 8, 60);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = src;
    const canvas = document.createElement("canvas");
    canvas.height = 54;
    canvas.width = Math.round(54 * (aspect > 0 ? aspect : 16 / 9));
    const ctx = canvas.getContext("2d");
    const seek = (t: number) =>
      new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("seek failed"));
        video.currentTime = t;
      });
    (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("load failed"));
        });
        const out: string[] = [];
        for (let i = 0; i < count && !cancelled; i++) {
          await seek(((i + 0.5) * duration) / count);
          if (cancelled || !ctx) break;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          out.push(canvas.toDataURL("image/jpeg", 0.6));
          if (i % 6 === 5 || i === count - 1) setThumbs([...out]);
        }
      } catch {
        // filmstrip is decoration; the track still works without it
      }
    })();
    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [src, duration, aspect]);
  return thumbs;
}

export function VideoEditorPanel() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importingUrl, setImportingUrl] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [playhead, setPlayhead] = useState(0); // source time
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [past, setPast] = useState<Segment[][]>([]);
  const [future, setFuture] = useState<Segment[][]>([]);
  const [zoom, setZoom] = useState(1);
  const [frameW, setFrameW] = useState(0);
  const [binOpen, setBinOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editSeqRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ index: number; edge: "start" | "end"; x: number; orig: Segment } | null>(null);
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  const source = project?.source ?? null;
  const duration = source?.metadata.duration ?? 0;
  const fps = source?.metadata.fps || 30;
  const segments = useMemo(() => project?.timeline?.segments ?? [], [project?.timeline]);
  const total = useMemo(() => segments.reduce((sum, s) => sum + segLen(s), 0), [segments]);
  const outPlayhead = srcToOut(segments, playhead);
  const sourceUrl = source ? `/api/video-editor/sources/${source.id}/file` : null;
  const aspect = source && source.metadata.height > 0 ? source.metadata.width / source.metadata.height : 16 / 9;
  const thumbs = useFilmstrip(sourceUrl, duration, aspect);

  const pps = total > 0 && frameW > 0 ? (Math.max(1, frameW - TRACK_PAD * 2) / total) * zoom : 0;
  const tickStep = TICK_STEPS.find((s) => s * pps >= 72) ?? TICK_STEPS.at(-1)!;
  const selectedSeg = selected != null ? (segments[selected] ?? null) : null;

  const library = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; duration: number | null }>();
    for (const p of projects) {
      if (p.sourceId && !seen.has(p.sourceId)) {
        seen.set(p.sourceId, { id: p.sourceId, name: p.sourceName ?? "Video", duration: p.sourceDuration });
      }
    }
    return [...seen.values()];
  }, [projects]);

  const resetEditor = () => {
    setPast([]);
    setFuture([]);
    setSelected(null);
    setPlaying(false);
  };

  const refreshProjects = async (preferId?: string) => {
    try {
      const res = await fetch("/api/video-editor/projects", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: ProjectSummary[] };
      setProjects(data.items);
      const pick = preferId ?? activeId ?? data.items[0]?.id ?? null;
      if (!pick) {
        setActiveId(null);
        setProject(null);
        return;
      }
      if (pick !== activeId) {
        setActiveId(pick);
      }
      if (data.items.some((item) => item.id === pick)) {
        return;
      }
      setActiveId(data.items[0]?.id ?? null);
    } catch {
      // ignore
    }
  };

  const loadProject = async (id: string) => {
    setLoadingProject(true);
    try {
      const res = await fetch(`/api/video-editor/projects/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("Failed to load project");
        return;
      }
      const data = (await res.json()) as { project: Project };
      setProject(data.project);
      setDirty(false);
      setPlayhead(data.project.timeline?.segments[0]?.start ?? 0);
      resetEditor();
    } finally {
      setLoadingProject(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadProject(activeId);
  }, [activeId]);

  // Autosave name + segments. sourceId and blur are not resent: re-sending sourceId re-attaches the
  // source server-side, which resets blur and drops the last export.
  useEffect(() => {
    if (!dirty || !project) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const seq = editSeqRef.current;
      setSaving(true);
      try {
        const payload: { name?: string; timeline?: EditTimeline | null } = { name: project.name };
        if (project.source) payload.timeline = project.timeline;

        const res = await fetch(`/api/video-editor/projects/${encodeURIComponent(project.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: "Autosave failed" }));
          toast.error(error.error || "Autosave failed");
          return;
        }

        const data = (await res.json()) as { project: Project };
        // Edits made while the request was in flight win; they re-arm this effect.
        if (editSeqRef.current === seq) {
          setProject(data.project);
          setDirty(false);
        }
        await refreshProjects(data.project.id);
      } finally {
        setSaving(false);
      }
    }, 650);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dirty, project]);

  const createNewProject = async () => {
    setCreatingProject(true);
    try {
      const res = await fetch("/api/video-editor/projects", { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to create project");
        return;
      }
      const data = (await res.json()) as { project: Project };
      await refreshProjects(data.project.id);
      setActiveId(data.project.id);
      toast.success("Project created");
    } finally {
      setCreatingProject(false);
    }
  };

  const updateProject = (updater: (current: Project) => Project) => {
    editSeqRef.current += 1;
    setProject((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  };

  const attachSource = async (sourceId: string): Promise<boolean> => {
    if (!project) return false;
    const patch = await fetch(`/api/video-editor/projects/${encodeURIComponent(project.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    if (!patch.ok) {
      const err = await patch.json().catch(() => ({}));
      toast.error(err.error || "Failed to attach source");
      return false;
    }
    const payload = (await patch.json()) as { project: Project };
    setProject(payload.project);
    setDirty(false);
    setPlayhead(0);
    resetEditor();
    await refreshProjects(payload.project.id);
    return true;
  };

  const importFromUpload = async (file: File) => {
    if (!project) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/video-editor/import/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.source?.id) {
        toast.error(data?.error || "Upload import failed");
        return;
      }
      if (await attachSource(data.source.id)) toast.success("Video imported");
    } finally {
      setUploading(false);
    }
  };

  const importFromUrl = async () => {
    if (!project) return;
    const url = urlInput.trim();
    if (!url) return;

    setImportingUrl(true);
    try {
      const res = await fetch("/api/video-editor/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.source?.id) {
        toast.error(data?.error || "URL import failed");
        return;
      }
      if (await attachSource(data.source.id)) {
        setUrlInput("");
        toast.success("Video imported from URL");
      }
    } finally {
      setImportingUrl(false);
    }
  };

  const removeBlur = async () => {
    if (!project) return;
    const res = await fetch(`/api/video-editor/projects/${encodeURIComponent(project.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blur: { ...project.blur, enabled: false } satisfies BlurFilter }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to remove blur");
      return;
    }
    const data = (await res.json()) as { project: Project };
    setProject((prev) => (prev ? { ...prev, blur: data.project.blur } : prev));
    toast.success("Blur removed");
  };

  const renderProject = async () => {
    if (!project) return;
    setRendering(true);
    try {
      const res = await fetch(`/api/video-editor/projects/${encodeURIComponent(project.id)}/render`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.render) {
        toast.error(data?.error || "Render failed");
        return;
      }

      const render = data.render as RenderResult;
      setProject((current) => (current ? { ...current, lastRenderId: render.id, lastRender: render } : current));
      await refreshProjects(project.id);
      toast.success("Export complete");
    } finally {
      setRendering(false);
    }
  };

  // ---------------- Edit operations (undoable) ----------------

  const seekSrc = (t: number) => {
    setPlayhead(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const seekOut = (o: number) => seekSrc(outToSrc(segments, clamp(o, 0, total)));

  const setSegments = (next: Segment[], record = true) => {
    if (record) {
      setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), segments]);
      setFuture([]);
    }
    updateProject((current) => ({ ...current, timeline: { segments: next } }));
  };

  const undo = () => {
    const prev = past.at(-1);
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([segments, ...future]);
    setSelected(null);
    updateProject((current) => ({ ...current, timeline: { segments: prev } }));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, segments]);
    setSelected(null);
    updateProject((current) => ({ ...current, timeline: { segments: next } }));
  };

  const splitAtPlayhead = () => {
    const i = segments.findIndex((s) => playhead > s.start + MIN_GAP && playhead < s.end - MIN_GAP);
    if (i < 0) {
      toast.error("Move the playhead inside a clip, away from its edges, to split");
      return;
    }
    const s = segments[i];
    setSegments([
      ...segments.slice(0, i),
      { start: s.start, end: playhead },
      { start: playhead, end: s.end },
      ...segments.slice(i + 1),
    ]);
    setSelected(i + 1);
  };

  const deleteSegment = (i: number) => {
    if (segments.length <= 1) {
      toast.error("The timeline needs at least one segment");
      return;
    }
    const next = segments.filter((_, j) => j !== i);
    setSegments(next);
    setSelected(null);
    const removed = segments[i];
    if (playhead >= removed.start && playhead <= removed.end) {
      seekSrc(next[i]?.start ?? next.at(-1)!.end);
    }
  };

  // In/out change for one segment, clamped to its neighbours so segments never overlap.
  const setEdge = (i: number, edge: "start" | "end", value: number, record = true) => {
    const s = segments[i];
    if (!s) return;
    const next =
      edge === "start"
        ? { ...s, start: clamp(value, segments[i - 1]?.end ?? 0, s.end - MIN_GAP) }
        : { ...s, end: clamp(value, s.start + MIN_GAP, segments[i + 1]?.start ?? duration) };
    setSegments(
      segments.map((x, j) => (j === i ? next : x)),
      record,
    );
    seekSrc(edge === "start" ? next.start : next.end);
  };

  // ---------------- Playback ----------------

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || segments.length === 0) return;
    if (!v.paused) {
      v.pause();
      return;
    }
    const inside = segments.some((s) => v.currentTime >= s.start && v.currentTime < s.end - 0.01);
    if (!inside) {
      const next = segments.find((s) => s.start >= v.currentTime);
      v.currentTime = next ? next.start : segments[0].start;
    }
    void v.play();
  };

  const stepFrame = (dir: 1 | -1) => {
    videoRef.current?.pause();
    seekOut(outPlayhead + dir / fps);
  };

  // While playing, hop over cut gaps and stop at the end of the last segment.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      const t = v.currentTime;
      const inside = segments.some((s) => t >= s.start - 0.01 && t < s.end);
      if (!inside) {
        const next = segments.find((s) => s.start >= t - 0.01);
        if (next) v.currentTime = next.start;
        else {
          v.pause();
          const end = segments.at(-1)?.end;
          if (end != null) v.currentTime = end;
        }
      }
      setPlayhead(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, segments]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setFrameW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [source?.id]);

  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (!source) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod) {
        return;
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        stepFrame(e.key === "ArrowLeft" ? -1 : 1);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        splitAtPlayhead();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected != null) {
        e.preventDefault();
        deleteSegment(selected);
      }
    };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------------- Timeline pointer handling ----------------

  const outFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || pps <= 0) return 0;
    return clamp((clientX - rect.left - TRACK_PAD) / pps, 0, total);
  };

  const onScrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    videoRef.current?.pause();
    seekOut(outFromPointer(e.clientX));
  };

  const onScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekOut(outFromPointer(e.clientX));
  };

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>, index: number, edge: "start" | "end") => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    videoRef.current?.pause();
    dragRef.current = { index, edge, x: e.clientX, orig: segments[index] };
    setSelected(index);
    setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), segments]);
    setFuture([]);
  };

  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || pps <= 0) return;
    const dt = (e.clientX - d.x) / pps;
    setEdge(d.index, d.edge, (d.edge === "start" ? d.orig.start : d.orig.end) + dt, false);
  };

  const onHandleUp = () => {
    dragRef.current = null;
  };

  // ---------------- Panels ----------------

  const exportsList = projects.filter((p) => p.lastRenderId);

  const binPanel = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!project || uploading}>
          {uploading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
          {uploading ? "Uploading" : "Upload file"}
        </Button>
        <p className="text-xs text-faint">Video files up to 500 MB.</p>
      </div>
      <Label className="flex flex-col items-stretch gap-2 border-t border-border pt-4">
        Import from URL
        <Input
          placeholder="https://www.youtube.com/watch?v=..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void importFromUrl();
            }
          }}
          disabled={!project || importingUrl}
        />
      </Label>
      <Button variant="outline" onClick={importFromUrl} disabled={!project || importingUrl || !urlInput.trim()}>
        {importingUrl ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
        {importingUrl ? "Importing" : "Import"}
      </Button>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h2 className="text-sm font-medium">
          Media <span className="num font-normal text-muted-foreground">{library.length}</span>
        </h2>
        {library.length === 0 ? (
          <p className="text-sm text-faint">Imported clips show up here.</p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-2">
              {library.map((item) => {
                const inUse = item.id === source?.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={inUse || !project}
                      onClick={() => {
                        void attachSource(item.id).then((ok) => ok && toast.success(`Now editing ${item.name}`));
                        setBinOpen(false);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer flex-col gap-1.5 rounded-xl p-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default",
                        inUse ? "bg-raised" : "hover:bg-accent",
                      )}
                      title={inUse ? "In the timeline" : "Replace the timeline clip with this one"}
                    >
                      <video
                        src={`/api/video-editor/sources/${item.id}/file#t=0.5`}
                        preload="metadata"
                        muted
                        playsInline
                        className="aspect-video w-full rounded-lg bg-black object-cover"
                      />
                      <span className="truncate px-0.5 text-xs">{item.name}</span>
                      <span className="num px-0.5 text-xs text-faint">
                        {inUse ? "In timeline" : item.duration != null ? fmtTC(item.duration, 30) : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-faint">Picking a clip replaces the one in the timeline and clears its edits.</p>
          </>
        )}
      </div>
    </div>
  );

  const inspectorPanel = (
    <div className="flex flex-col gap-5">
      <Label className="flex flex-col items-stretch gap-2">
        Project name
        <Input
          value={project?.name ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            updateProject((current) => ({ ...current, name: value }));
          }}
          disabled={!project || loadingProject}
        />
      </Label>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        {selectedSeg && selected != null ? (
          <>
            <h2 className="text-sm font-medium">
              Segment <span className="num font-normal text-muted-foreground">{selected + 1} of {segments.length}</span>
            </h2>
            <TimecodeField
              key={`in-${selected}-${selectedSeg.start}`}
              label="In"
              value={selectedSeg.start}
              fps={fps}
              onCommit={(v) => setEdge(selected, "start", v)}
            />
            <TimecodeField
              key={`out-${selected}-${selectedSeg.end}`}
              label="Out"
              value={selectedSeg.end}
              fps={fps}
              onCommit={(v) => setEdge(selected, "end", v)}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Length</span>
              <span className="num">{fmtTC(segLen(selectedSeg), fps)}</span>
            </div>
            <Button variant="outline" onClick={() => deleteSegment(selected)} disabled={segments.length <= 1}>
              <Trash2 data-icon="inline-start" /> Delete segment
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-sm font-medium">Clip</h2>
            {source ? (
              <dl className="num grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="truncate text-right">{source.originalName}</dd>
                <dt className="text-muted-foreground">Resolution</dt>
                <dd className="text-right">
                  {source.metadata.width}×{source.metadata.height}
                </dd>
                <dt className="text-muted-foreground">File size</dt>
                <dd className="text-right">{toMb(source.sizeBytes)}</dd>
                <dt className="text-muted-foreground">Frame rate</dt>
                <dd className="text-right">{Math.round(fps)} fps</dd>
                <dt className="text-muted-foreground">Source length</dt>
                <dd className="text-right">{fmtTC(duration, fps)}</dd>
                <dt className="text-muted-foreground">Segments</dt>
                <dd className="text-right">{segments.length}</dd>
                <dt className="text-muted-foreground">Output length</dt>
                <dd className="text-right">{fmtTC(total, fps)}</dd>
              </dl>
            ) : (
              <p className="text-sm text-faint">No clip yet.</p>
            )}
            {source && <p className="text-xs text-faint">Select a segment on the timeline to set its in and out points.</p>}
          </>
        )}
      </div>

      {project?.blur.enabled && (
        <div className="flex flex-col gap-2 border-t border-border pt-5">
          <p className="text-sm text-warning">A blur box from an earlier version is applied on export.</p>
          <Button variant="ghost" size="sm" className="self-start" onClick={removeBlur}>
            Remove blur
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-5">
        <h2 className="pb-1 text-sm font-medium">Exports</h2>
        {rendering && (
          <div className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="truncate text-muted-foreground">{project?.name}</span>
            <Badge variant="warning">Rendering</Badge>
          </div>
        )}
        {exportsList.length === 0 && !rendering ? (
          <p className="text-sm text-faint">Nothing exported yet.</p>
        ) : (
          exportsList.map((p) => {
            const last = p.id === project?.id ? project.lastRender : null;
            return (
              <div key={p.id} className="flex flex-col gap-1.5 border-t border-border py-2.5 first:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{p.name}</span>
                  <Badge variant="positive">Ready</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="num truncate text-xs text-faint">
                    {last ? `${toMb(last.sizeBytes)} · ${fmtTC(last.metadata.duration, last.metadata.fps || 30)}` : "Last export"}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    nativeButton={false}
                    render={<a href={last?.downloadUrl ?? `/api/video-editor/exports/${p.lastRenderId}/file`} />}
                  >
                    <Download data-icon="inline-start" /> Download
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ---------------- Render ----------------

  const ticks: number[] = [];
  if (pps > 0) for (let t = 0; t <= total + 1e-6; t += tickStep) ticks.push(t);
  const laidOut = segments.map((s) => ({ seg: s, left: srcToOut(segments, s.start) }));
  const contentW = total * pps + TRACK_PAD * 2;

  return (
    <>
      <AppTopbar title="Video editor" icon={Clapperboard}>
        <span className="hidden text-xs text-muted-foreground xl:inline">
          {saving ? "Saving" : dirty ? "Unsaved" : project ? "Saved" : null}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="max-w-[6rem] min-w-0 text-white sm:max-w-[14rem]" disabled={projects.length === 0} />}
          >
            <span className="truncate">{project?.name ?? "No project"}</span>
            <ChevronsUpDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              {projects.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => setActiveId(p.id)} className="py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{p.name}</span>
                    <span className="truncate text-xs text-faint">{p.sourceName ?? "No clip"}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={createNewProject}>
              <Plus /> New project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" onClick={createNewProject} disabled={creatingProject} className="hidden lg:inline-flex">
          {creatingProject ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
          New project
        </Button>
        <Button onClick={renderProject} disabled={!source || !project?.timeline || rendering}>
          {rendering ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Film data-icon="inline-start" />}
          {rendering ? "Exporting" : "Export"}
        </Button>
      </AppTopbar>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload video file"
        disabled={!project || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBinOpen(false);
          void importFromUpload(file);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-4 pt-4 pb-16 md:px-7 xl:h-[calc(100svh-4rem)] xl:flex-none xl:pb-4">
        <h1 className="sr-only">Video editor{project ? `, ${project.name}` : ""}</h1>

        <div className="flex gap-2 xl:hidden">
          <Button variant="outline" size="sm" onClick={() => setBinOpen(true)}>
            <Upload data-icon="inline-start" /> Media
          </Button>
          <Button variant="outline" size="sm" onClick={() => setInspectorOpen(true)}>
            <SlidersHorizontal data-icon="inline-start" /> Inspector
          </Button>
        </div>

        <div className="flex min-h-0 flex-col gap-3.5 xl:flex-1 xl:flex-row">
          <aside className="hidden w-56 shrink-0 overflow-y-auto rounded-[20px] bg-card p-4 xl:block">{binPanel}</aside>

          {/* ---------------- Stage + transport ---------------- */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-[20px] bg-card p-2.5">
            <div className="flex aspect-video min-h-0 w-full items-center justify-center overflow-hidden rounded-2xl bg-black xl:aspect-auto xl:flex-1">
              {source && sourceUrl ? (
                <video
                  ref={videoRef}
                  playsInline
                  className="size-full object-contain"
                  src={sourceUrl}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(e) => !playing && setPlayhead(e.currentTarget.currentTime)}
                  onClick={togglePlay}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {loadingProject
                      ? "Loading project"
                      : project
                        ? "No clip in this project yet."
                        : projects.length === 0
                          ? "No projects yet."
                          : "Pick a project."}
                  </p>
                  {project ? (
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
                      {uploading ? "Uploading" : "Upload a video"}
                    </Button>
                  ) : (
                    !loadingProject && (
                      <Button variant="outline" onClick={createNewProject} disabled={creatingProject}>
                        <Plus data-icon="inline-start" /> New project
                      </Button>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1.5 pb-0.5">
              <span className="num text-sm">
                {fmtTC(outPlayhead, fps)} <span className="text-faint">/ {fmtTC(total, fps)}</span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Jump to start"
                  disabled={!source}
                  onClick={() => {
                    videoRef.current?.pause();
                    seekOut(0);
                  }}
                >
                  <SkipBack />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Previous frame" disabled={!source} onClick={() => stepFrame(-1)}>
                  <StepBack />
                </Button>
                <Button variant="outline" size="icon" aria-label={playing ? "Pause" : "Play"} disabled={!source} onClick={togglePlay}>
                  {playing ? <Pause /> : <Play />}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Next frame" disabled={!source} onClick={() => stepFrame(1)}>
                  <StepForward />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Jump to end"
                  disabled={!source}
                  onClick={() => {
                    videoRef.current?.pause();
                    seekOut(total);
                  }}
                >
                  <SkipForward />
                </Button>
              </div>
              <span className="hidden text-xs text-faint sm:inline">Space play · ←→ frame · S split</span>
            </div>
          </section>

          <aside className="hidden w-64 shrink-0 overflow-y-auto rounded-[20px] bg-card p-4 xl:block">{inspectorPanel}</aside>
        </div>

        {/* ---------------- Timeline ---------------- */}
        <section className="flex shrink-0 flex-col rounded-[20px] bg-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 pb-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={splitAtPlayhead} disabled={!source}>
                <Scissors data-icon="inline-start" /> Split
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selected != null && deleteSegment(selected)}
                disabled={selected == null || segments.length <= 1}
              >
                <Trash2 data-icon="inline-start" /> Delete
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Undo" onClick={undo} disabled={past.length === 0}>
                <Undo2 />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Redo" onClick={redo} disabled={future.length === 0}>
                <Redo2 />
              </Button>
            </div>
            <span className="num text-sm text-muted-foreground">
              Output <span className="text-white">{fmtTC(total, fps)}</span>
              {source && <span className="text-faint"> of {fmtTC(duration, fps)}</span>}
            </span>
            <label className="ml-auto flex items-center gap-2 text-faint">
              <ZoomIn className="size-4" aria-hidden />
              <span className="sr-only">Timeline zoom</span>
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                disabled={!source}
                className="w-24 cursor-pointer accent-white sm:w-32"
              />
            </label>
          </div>

          <div ref={frameRef} className="overflow-x-auto overflow-y-hidden pb-3">
            {!source || segments.length === 0 ? (
              <p className="border-t border-border px-4 py-8 text-sm text-faint">
                {source ? "This clip has no segments." : "Add a clip to build the timeline."}
              </p>
            ) : (
              <div ref={trackRef} className="relative select-none" style={{ width: contentW }}>
                {/* ruler */}
                <div
                  className="relative h-7 cursor-pointer touch-none border-b border-border"
                  onPointerDown={onScrubDown}
                  onPointerMove={onScrubMove}
                >
                  {ticks.map((t) => (
                    <div key={t} className="absolute top-0 h-full" style={{ left: TRACK_PAD + t * pps }}>
                      <div className="h-2 w-px bg-faint" />
                      <span className="num absolute top-2 left-1 text-[11px] whitespace-nowrap text-faint">
                        {tickStep < 1 ? fmtTC(t, fps) : `${pad2(Math.floor(t / 60))}:${pad2(Math.round(t % 60))}`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* video track */}
                <div className="relative my-2 h-16" onPointerDown={() => setSelected(null)}>
                  {laidOut.map(({ seg, left }, i) => {
                    const isSel = i === selected;
                    const thumbW = thumbs.length ? (duration / thumbs.length) * pps : 0;
                    return (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        aria-label={`Segment ${i + 1}, ${fmtTC(seg.start, fps)} to ${fmtTC(seg.end, fps)}`}
                        aria-pressed={isSel}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelected(i);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setSelected(i);
                        }}
                        className={cn(
                          "group absolute inset-y-0 cursor-pointer overflow-hidden rounded-lg bg-raised focus-visible:outline-2 focus-visible:outline-white",
                          isSel && "outline-2 -outline-offset-2 outline-data",
                        )}
                        style={{ left: TRACK_PAD + left * pps + 1, width: Math.max(2, segLen(seg) * pps - 2) }}
                      >
                        <div
                          className="pointer-events-none absolute inset-y-0 flex"
                          style={{ left: -seg.start * pps, width: duration * pps }}
                        >
                          {thumbs.map((src, k) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={k} src={src} alt="" className="h-full shrink-0 object-cover" style={{ width: thumbW }} />
                          ))}
                        </div>
                        {(["start", "end"] as const).map((edge) => (
                          <div
                            key={edge}
                            aria-hidden
                            onPointerDown={(e) => onHandleDown(e, i, edge)}
                            onPointerMove={onHandleMove}
                            onPointerUp={onHandleUp}
                            onPointerCancel={onHandleUp}
                            className={cn(
                              "absolute inset-y-0 z-10 flex w-2.5 cursor-ew-resize touch-none items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100",
                              edge === "start" ? "left-0" : "right-0",
                              isSel && "opacity-100",
                            )}
                          >
                            <div className="h-6 w-0.5 rounded-full bg-white" />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* playhead */}
                <div
                  className="absolute top-0 bottom-0 z-20 w-4 -translate-x-1/2 cursor-ew-resize touch-none"
                  style={{ left: TRACK_PAD + outPlayhead * pps }}
                  onPointerDown={onScrubDown}
                  onPointerMove={onScrubMove}
                  aria-hidden
                >
                  <div className="absolute top-0 left-1/2 size-3 -translate-x-1/2 rounded-full bg-data" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-data" />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <Sheet open={binOpen} onOpenChange={setBinOpen}>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Media</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{binPanel}</div>
        </SheetContent>
      </Sheet>
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Inspector</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{inspectorPanel}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Uncontrolled: remounted (via key) whenever the committed value changes.
function TimecodeField({
  label,
  value,
  fps,
  onCommit,
}: {
  label: string;
  value: number;
  fps: number;
  onCommit: (v: number) => void;
}) {
  const commit = (input: HTMLInputElement) => {
    const parsed = parseTC(input.value, fps);
    if (parsed == null) {
      input.value = fmtTC(value, fps);
      return;
    }
    if (Math.abs(parsed - value) > 1e-6) onCommit(parsed);
  };
  return (
    <Label className="flex items-center justify-between gap-3 font-normal">
      <span className="text-muted-foreground">{label}</span>
      <Input
        defaultValue={fmtTC(value, fps)}
        inputMode="decimal"
        className="num w-28 text-right"
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget);
        }}
      />
    </Label>
  );
}
