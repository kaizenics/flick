"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clapperboard, Download, Loader2, Plus, Save, Upload } from "lucide-react";

type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
};

type VideoSource = {
  id: string;
  kind: "upload" | "url";
  originalName: string;
  mimeType: string;
  sourceUrl: string | null;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  metadata: VideoMetadata;
};

type EditTimeline = {
  trimStart: number;
  trimEnd: number;
  cutStart: number | null;
  cutEnd: number | null;
};

type BlurFilter = {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  startTime: number;
  endTime: number;
  strength: number;
};

type RenderResult = {
  id: string;
  projectId: string;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  metadata: VideoMetadata;
  downloadUrl?: string;
};

type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string | null;
  sourceName: string | null;
  sourceDuration: number | null;
  lastRenderId: string | null;
};

type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string | null;
  timeline: EditTimeline | null;
  blur: BlurFilter;
  lastRenderId: string | null;
  source: VideoSource | null;
  lastRender: RenderResult | null;
};

const MIN_GAP = 0.05;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

function toNum(value: string, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function toMb(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [playhead, setPlayhead] = useState(0);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const duration = project?.source?.metadata.duration ?? 0;

  const hasCut = useMemo(() => {
    if (!project?.timeline) return false;
    return project.timeline.cutStart != null && project.timeline.cutEnd != null;
  }, [project?.timeline]);

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
      setPlayhead(0);
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

  useEffect(() => {
    if (!dirty || !project) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const payload: {
          name?: string;
          sourceId?: string | null;
          timeline?: EditTimeline | null;
          blur?: BlurFilter;
        } = {
          name: project.name,
          sourceId: project.sourceId,
        };
        if (project.source) {
          payload.timeline = project.timeline;
          payload.blur = project.blur;
        } else {
          payload.timeline = null;
        }

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
        setProject(data.project);
        setDirty(false);
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
    setProject((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setDirty(true);
      return next;
    });
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

      const patch = await fetch(`/api/video-editor/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: data.source.id }),
      });
      if (!patch.ok) {
        const err = await patch.json().catch(() => ({}));
        toast.error(err.error || "Failed to attach source");
        return;
      }
      const payload = (await patch.json()) as { project: Project };
      setProject(payload.project);
      setDirty(false);
      setPlayhead(0);
      await refreshProjects(payload.project.id);
      toast.success("Video imported");
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

      const patch = await fetch(`/api/video-editor/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: data.source.id }),
      });
      if (!patch.ok) {
        const err = await patch.json().catch(() => ({}));
        toast.error(err.error || "Failed to attach source");
        return;
      }
      const payload = (await patch.json()) as { project: Project };
      setProject(payload.project);
      setDirty(false);
      setUrlInput("");
      setPlayhead(0);
      await refreshProjects(payload.project.id);
      toast.success("Video imported from URL");
    } finally {
      setImportingUrl(false);
    }
  };

  const setTrimStart = (value: number) => {
    if (!project?.timeline || !project.source) return;
    updateProject((current) => {
      if (!current.timeline || !current.source) return current;
      const max = current.timeline.trimEnd - MIN_GAP;
      const trimStart = clamp(value, 0, Math.max(0, max));
      let cutStart = current.timeline.cutStart;
      let cutEnd = current.timeline.cutEnd;
      if (cutStart != null && cutEnd != null) {
        if (cutStart < trimStart) cutStart = trimStart;
        if (cutEnd <= cutStart) cutEnd = clamp(cutStart + MIN_GAP, trimStart + MIN_GAP, current.timeline.trimEnd);
      }
      return {
        ...current,
        timeline: {
          ...current.timeline,
          trimStart,
          cutStart,
          cutEnd,
        },
      };
    });
  };

  const setTrimEnd = (value: number) => {
    if (!project?.timeline || !project.source) return;
    updateProject((current) => {
      if (!current.timeline || !current.source) return current;
      const min = current.timeline.trimStart + MIN_GAP;
      const trimEnd = clamp(value, min, current.source.metadata.duration);
      let cutStart = current.timeline.cutStart;
      let cutEnd = current.timeline.cutEnd;
      if (cutStart != null && cutEnd != null) {
        if (cutEnd > trimEnd) cutEnd = trimEnd;
        if (cutStart >= cutEnd) cutStart = clamp(cutEnd - MIN_GAP, current.timeline.trimStart, trimEnd - MIN_GAP);
      }
      return {
        ...current,
        timeline: {
          ...current.timeline,
          trimEnd,
          cutStart,
          cutEnd,
        },
      };
    });
  };

  const toggleCut = (enabled: boolean) => {
    if (!project?.timeline || !project.source) return;
    updateProject((current) => {
      if (!current.timeline) return current;
      if (!enabled) {
        return {
          ...current,
          timeline: { ...current.timeline, cutStart: null, cutEnd: null },
        };
      }
      const span = current.timeline.trimEnd - current.timeline.trimStart;
      const start = current.timeline.trimStart + span * 0.35;
      const end = current.timeline.trimStart + span * 0.5;
      return {
        ...current,
        timeline: {
          ...current.timeline,
          cutStart: start,
          cutEnd: Math.max(start + MIN_GAP, end),
        },
      };
    });
  };

  const setCutStart = (value: number) => {
    if (!project?.timeline || project.timeline.cutStart == null || project.timeline.cutEnd == null) return;
    updateProject((current) => {
      if (!current.timeline || current.timeline.cutStart == null || current.timeline.cutEnd == null) return current;
      const max = current.timeline.cutEnd - MIN_GAP;
      const cutStart = clamp(value, current.timeline.trimStart, max);
      return {
        ...current,
        timeline: {
          ...current.timeline,
          cutStart,
        },
      };
    });
  };

  const setCutEnd = (value: number) => {
    if (!project?.timeline || project.timeline.cutStart == null || project.timeline.cutEnd == null) return;
    updateProject((current) => {
      if (!current.timeline || current.timeline.cutStart == null || current.timeline.cutEnd == null) return current;
      const min = current.timeline.cutStart + MIN_GAP;
      const cutEnd = clamp(value, min, current.timeline.trimEnd);
      return {
        ...current,
        timeline: {
          ...current.timeline,
          cutEnd,
        },
      };
    });
  };

  const setBlurField = (field: keyof BlurFilter, value: number | boolean) => {
    if (!project?.source) return;
    updateProject((current) => {
      const next = { ...current.blur, [field]: value };
      return { ...current, blur: next };
    });
  };

  const onScrub = (next: number) => {
    setPlayhead(next);
    if (videoRef.current) {
      videoRef.current.currentTime = next;
    }
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
      updateProject((current) => ({
        ...current,
        lastRenderId: render.id,
        lastRender: render,
      }));
      setDirty(false);
      await refreshProjects(project.id);
      toast.success("Export complete");
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Clapperboard className="size-4" />
          <span className="text-sm font-medium">Video Editor</span>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Save className="size-3" /> Saving…
            </span>
          )}
          <Button size="sm" onClick={createNewProject} disabled={creatingProject}>
            {creatingProject ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New Project
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Project</CardTitle>
            <CardDescription>Pick a saved project or create a new one.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="project-select">Active project</Label>
              <select
                id="project-select"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={activeId ?? ""}
                onChange={(e) => setActiveId(e.target.value || null)}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={project?.name ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  updateProject((current) => ({ ...current, name: value }));
                }}
                disabled={!project || loadingProject}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Source</CardTitle>
            <CardDescription>Upload a local video or import using a URL.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2 rounded-md border border-border p-3">
              <Label htmlFor="upload">Upload file (max 500 MB)</Label>
              <Input
                id="upload"
                type="file"
                accept="video/*"
                disabled={!project || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void importFromUpload(file);
                  e.currentTarget.value = "";
                }}
              />
              <Button type="button" variant="outline" disabled>
                <Upload className="size-4" /> Select video above
              </Button>
            </div>

            <div className="grid gap-2 rounded-md border border-border p-3">
              <Label htmlFor="url-import">Import via URL</Label>
              <Input
                id="url-import"
                placeholder="https://www.youtube.com/watch?v=..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={!project || importingUrl}
              />
              <Button
                onClick={importFromUrl}
                disabled={!project || importingUrl || !urlInput.trim()}
              >
                {importingUrl ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Import from URL
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {project?.source
                ? `${project.source.originalName} · ${toMb(project.source.sizeBytes)} · ${project.source.metadata.width}x${project.source.metadata.height}`
                : "No source attached yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {project?.source ? (
              <>
                <video
                  ref={videoRef}
                  controls
                  className="w-full rounded-md border border-border bg-black"
                  src={`/api/video-editor/sources/${project.source.id}/file`}
                  onTimeUpdate={(e) => setPlayhead((e.currentTarget as HTMLVideoElement).currentTime)}
                />
                <div className="grid gap-2">
                  <Label htmlFor="scrub">Scrubber ({formatSeconds(playhead)}s)</Label>
                  <Input
                    id="scrub"
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(playhead, duration || 0)}
                    onChange={(e) => onScrub(toNum(e.target.value, 0))}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Import a source first to unlock timeline editing.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline (Trim + Cut)</CardTitle>
            <CardDescription>
              Trim start/end and optionally remove one middle section.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {project?.source && project.timeline ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Trim start</Label>
                    <Input
                      type="range"
                      min={0}
                      max={duration}
                      step={0.01}
                      value={project.timeline.trimStart}
                      onChange={(e) => setTrimStart(toNum(e.target.value, project.timeline!.trimStart))}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={project.timeline.trimEnd - MIN_GAP}
                      step={0.01}
                      value={formatSeconds(project.timeline.trimStart)}
                      onChange={(e) => setTrimStart(toNum(e.target.value, project.timeline!.trimStart))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Trim end</Label>
                    <Input
                      type="range"
                      min={0}
                      max={duration}
                      step={0.01}
                      value={project.timeline.trimEnd}
                      onChange={(e) => setTrimEnd(toNum(e.target.value, project.timeline!.trimEnd))}
                    />
                    <Input
                      type="number"
                      min={project.timeline.trimStart + MIN_GAP}
                      max={duration}
                      step={0.01}
                      value={formatSeconds(project.timeline.trimEnd)}
                      onChange={(e) => setTrimEnd(toNum(e.target.value, project.timeline!.trimEnd))}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <Label htmlFor="cut-toggle">Enable middle cut</Label>
                    <input
                      id="cut-toggle"
                      type="checkbox"
                      checked={hasCut}
                      onChange={(e) => toggleCut(e.target.checked)}
                    />
                  </div>

                  {hasCut && project.timeline.cutStart != null && project.timeline.cutEnd != null && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Cut start</Label>
                        <Input
                          type="range"
                          min={project.timeline.trimStart}
                          max={project.timeline.cutEnd - MIN_GAP}
                          step={0.01}
                          value={project.timeline.cutStart}
                          onChange={(e) => setCutStart(toNum(e.target.value, project.timeline!.cutStart!))}
                        />
                        <Input
                          type="number"
                          min={project.timeline.trimStart}
                          max={project.timeline.cutEnd - MIN_GAP}
                          step={0.01}
                          value={formatSeconds(project.timeline.cutStart)}
                          onChange={(e) => setCutStart(toNum(e.target.value, project.timeline!.cutStart!))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Cut end</Label>
                        <Input
                          type="range"
                          min={project.timeline.cutStart + MIN_GAP}
                          max={project.timeline.trimEnd}
                          step={0.01}
                          value={project.timeline.cutEnd}
                          onChange={(e) => setCutEnd(toNum(e.target.value, project.timeline!.cutEnd!))}
                        />
                        <Input
                          type="number"
                          min={project.timeline.cutStart + MIN_GAP}
                          max={project.timeline.trimEnd}
                          step={0.01}
                          value={formatSeconds(project.timeline.cutEnd)}
                          onChange={(e) => setCutEnd(toNum(e.target.value, project.timeline!.cutEnd!))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Load a source to edit timeline.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blur Filter</CardTitle>
            <CardDescription>
              Apply one static blur rectangle over a selected time window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {project?.source ? (
              <>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor="blur-enabled">Enable blur</Label>
                  <input
                    id="blur-enabled"
                    type="checkbox"
                    checked={project.blur.enabled}
                    onChange={(e) => setBlurField("enabled", e.target.checked)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1">
                    <Label>X</Label>
                    <Input
                      type="number"
                      value={project.blur.x}
                      onChange={(e) => setBlurField("x", toNum(e.target.value, project.blur.x))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Y</Label>
                    <Input
                      type="number"
                      value={project.blur.y}
                      onChange={(e) => setBlurField("y", toNum(e.target.value, project.blur.y))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Strength</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={project.blur.strength}
                      onChange={(e) => setBlurField("strength", toNum(e.target.value, project.blur.strength))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Width</Label>
                    <Input
                      type="number"
                      min={1}
                      value={project.blur.width}
                      onChange={(e) => setBlurField("width", toNum(e.target.value, project.blur.width))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Height</Label>
                    <Input
                      type="number"
                      min={1}
                      value={project.blur.height}
                      onChange={(e) => setBlurField("height", toNum(e.target.value, project.blur.height))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Start / End (s)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={formatSeconds(project.blur.startTime)}
                        onChange={(e) => setBlurField("startTime", toNum(e.target.value, project.blur.startTime))}
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={formatSeconds(project.blur.endTime)}
                        onChange={(e) => setBlurField("endTime", toNum(e.target.value, project.blur.endTime))}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Load a source to configure blur.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Render edited video to MP4.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {project?.lastRender
                ? `Last export: ${new Date(project.lastRender.createdAt).toLocaleString()} · ${toMb(project.lastRender.sizeBytes)}`
                : "No exports yet."}
            </div>
            <div className="flex items-center gap-2">
              {project?.lastRender && (
                <Button
                  variant="outline"
                  render={
                    <a
                      href={
                        project.lastRender.downloadUrl ??
                        `/api/video-editor/exports/${project.lastRender.id}/file`
                      }
                    />
                  }
                >
                  Download Latest
                </Button>
              )}
              <Button onClick={renderProject} disabled={!project?.source || !project?.timeline || rendering}>
                {rendering ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
                Export MP4
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
