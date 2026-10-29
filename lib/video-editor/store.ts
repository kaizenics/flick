import { access, copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import crypto from "node:crypto";
import type {
  BlurFilter,
  EditTimeline,
  RenderResult,
  VideoEditorProject,
  VideoEditorProjectSummary,
  VideoEditorProjectWithRefs,
  VideoMetadata,
  VideoSource,
} from "@/lib/video-editor/types";
import { coerceSegments } from "@/lib/video-editor/segments";

export const VIDEO_EDITOR_DIR = join(process.cwd(), "data", "video-editor");
export const VIDEO_EDITOR_PROJECTS_DIR = join(VIDEO_EDITOR_DIR, "projects");
export const VIDEO_EDITOR_SOURCES_DIR = join(VIDEO_EDITOR_DIR, "sources");
export const VIDEO_EDITOR_EXPORTS_DIR = join(VIDEO_EDITOR_DIR, "exports");

const PROJECT_INDEX_FILE = join(VIDEO_EDITOR_DIR, "projects.json");
const SOURCE_INDEX_FILE = join(VIDEO_EDITOR_DIR, "sources.json");
const EXPORT_INDEX_FILE = join(VIDEO_EDITOR_DIR, "exports.json");

const MAX_NAME_LENGTH = 80;

type ProjectsFile = { items: VideoEditorProject[] };
type SourcesFile = { items: VideoSource[] };
type ExportsFile = { items: RenderResult[] };

const DEFAULT_BLUR: BlurFilter = {
  enabled: false,
  x: 0,
  y: 0,
  width: 120,
  height: 120,
  startTime: 0,
  endTime: 1,
  strength: 8,
};

async function ensureJsonFile(path: string, fallback: object): Promise<void> {
  try {
    await access(path);
  } catch {
    await writeFile(path, JSON.stringify(fallback, null, 2) + "\n", "utf8");
  }
}

async function ensureStore(): Promise<void> {
  await mkdir(VIDEO_EDITOR_DIR, { recursive: true });
  await mkdir(VIDEO_EDITOR_PROJECTS_DIR, { recursive: true });
  await mkdir(VIDEO_EDITOR_SOURCES_DIR, { recursive: true });
  await mkdir(VIDEO_EDITOR_EXPORTS_DIR, { recursive: true });
  await ensureJsonFile(PROJECT_INDEX_FILE, { items: [] });
  await ensureJsonFile(SOURCE_INDEX_FILE, { items: [] });
  await ensureJsonFile(EXPORT_INDEX_FILE, { items: [] });
}

function normalizeProjectName(name?: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Untitled project";
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

async function readProjects(): Promise<VideoEditorProject[]> {
  await ensureStore();
  try {
    const raw = await readFile(PROJECT_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as ProjectsFile;
    if (!Array.isArray(parsed.items)) return [];
    // Projects saved before multi-segment editing hold trim/cut fields; read them as segments.
    return parsed.items.map((p) => {
      if (!p.timeline) return p;
      const segments = coerceSegments(p.timeline);
      return { ...p, timeline: segments ? { segments } : null };
    });
  } catch {
    return [];
  }
}

async function writeProjects(items: VideoEditorProject[]): Promise<void> {
  await ensureStore();
  await writeFile(PROJECT_INDEX_FILE, JSON.stringify({ items }, null, 2) + "\n", "utf8");
}

async function readSources(): Promise<VideoSource[]> {
  await ensureStore();
  try {
    const raw = await readFile(SOURCE_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as SourcesFile;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function writeSources(items: VideoSource[]): Promise<void> {
  await ensureStore();
  await writeFile(SOURCE_INDEX_FILE, JSON.stringify({ items }, null, 2) + "\n", "utf8");
}

async function readExports(): Promise<RenderResult[]> {
  await ensureStore();
  try {
    const raw = await readFile(EXPORT_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as ExportsFile;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function writeExports(items: RenderResult[]): Promise<void> {
  await ensureStore();
  await writeFile(EXPORT_INDEX_FILE, JSON.stringify({ items }, null, 2) + "\n", "utf8");
}

function sourceFileExt(name: string): string {
  const raw = extname(name).toLowerCase();
  if (!raw) return ".mp4";
  if (raw.length > 8) return ".mp4";
  return /^[a-z0-9.]+$/.test(raw) ? raw : ".mp4";
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultTimelineForSource(meta: VideoMetadata): EditTimeline {
  return { segments: [{ start: 0, end: meta.duration }] };
}

function defaultBlurForSource(meta: VideoMetadata): BlurFilter {
  return {
    ...DEFAULT_BLUR,
    width: Math.max(20, Math.round(meta.width * 0.2)),
    height: Math.max(20, Math.round(meta.height * 0.2)),
    endTime: Math.min(1, meta.duration),
  };
}

export async function createProject(name?: string): Promise<VideoEditorProject> {
  const projects = await readProjects();
  const now = nowIso();
  const project: VideoEditorProject = {
    id: crypto.randomUUID(),
    name: normalizeProjectName(name),
    createdAt: now,
    updatedAt: now,
    sourceId: null,
    timeline: null,
    blur: { ...DEFAULT_BLUR },
    lastRenderId: null,
  };
  projects.push(project);
  await writeProjects(projects);
  return project;
}

export async function listProjectSummaries(): Promise<VideoEditorProjectSummary[]> {
  const [projects, sources] = await Promise.all([readProjects(), readSources()]);
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  return projects
    .map((p) => {
      const source = p.sourceId ? sourceMap.get(p.sourceId) ?? null : null;
      return {
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        sourceId: p.sourceId,
        sourceName: source?.originalName ?? null,
        sourceDuration: source?.metadata.duration ?? null,
        lastRenderId: p.lastRenderId,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getProjectById(id: string): Promise<VideoEditorProject | null> {
  const projects = await readProjects();
  return projects.find((p) => p.id === id) ?? null;
}

export async function getProjectByIdWithRefs(id: string): Promise<VideoEditorProjectWithRefs | null> {
  const [project, sources, renders] = await Promise.all([
    getProjectById(id),
    readSources(),
    readExports(),
  ]);
  if (!project) return null;
  const source = project.sourceId
    ? (sources.find((item) => item.id === project.sourceId) ?? null)
    : null;
  const lastRender = project.lastRenderId
    ? (renders.find((item) => item.id === project.lastRenderId) ?? null)
    : null;

  return {
    ...project,
    source,
    lastRender,
  };
}

export async function updateProjectById(
  id: string,
  patch: {
    name?: string;
    sourceId?: string | null;
    timeline?: EditTimeline | null;
    blur?: BlurFilter;
    lastRenderId?: string | null;
  },
): Promise<VideoEditorProject | null> {
  const projects = await readProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return null;

  const next = { ...projects[idx] };
  if (typeof patch.name === "string") {
    next.name = normalizeProjectName(patch.name);
  }
  if (patch.sourceId !== undefined) {
    next.sourceId = patch.sourceId;
  }
  if (patch.timeline !== undefined) {
    next.timeline = patch.timeline;
  }
  if (patch.blur !== undefined) {
    next.blur = patch.blur;
  }
  if (patch.lastRenderId !== undefined) {
    next.lastRenderId = patch.lastRenderId;
  }
  next.updatedAt = nowIso();
  projects[idx] = next;
  await writeProjects(projects);
  return next;
}

export async function createSourceFromBuffer(params: {
  kind: "upload" | "url";
  originalName: string;
  mimeType: string;
  sourceUrl?: string | null;
  data: Buffer;
  metadata: VideoMetadata;
}): Promise<VideoSource> {
  await ensureStore();
  const id = crypto.randomUUID();
  const ext = sourceFileExt(params.originalName);
  const fileName = `${id}${ext}`;
  const path = join(VIDEO_EDITOR_SOURCES_DIR, fileName);
  await writeFile(path, params.data);

  const source: VideoSource = {
    id,
    kind: params.kind,
    originalName: params.originalName || "video",
    mimeType: params.mimeType || "video/mp4",
    sourceUrl: params.sourceUrl ?? null,
    createdAt: nowIso(),
    fileName,
    sizeBytes: params.data.length,
    metadata: params.metadata,
  };

  const sources = await readSources();
  sources.push(source);
  await writeSources(sources);
  return source;
}

export async function createSourceFromFile(params: {
  kind: "upload" | "url";
  originalName: string;
  mimeType: string;
  sourceUrl?: string | null;
  tempPath: string;
  metadata: VideoMetadata;
}): Promise<VideoSource> {
  await ensureStore();
  const id = crypto.randomUUID();
  const ext = sourceFileExt(params.originalName);
  const fileName = `${id}${ext}`;
  const path = join(VIDEO_EDITOR_SOURCES_DIR, fileName);
  await copyFile(params.tempPath, path);
  const fileStat = await stat(path);

  const source: VideoSource = {
    id,
    kind: params.kind,
    originalName: params.originalName || "video",
    mimeType: params.mimeType || "video/mp4",
    sourceUrl: params.sourceUrl ?? null,
    createdAt: nowIso(),
    fileName,
    sizeBytes: fileStat.size,
    metadata: params.metadata,
  };

  const sources = await readSources();
  sources.push(source);
  await writeSources(sources);
  return source;
}

export async function getSourceById(id: string): Promise<VideoSource | null> {
  const sources = await readSources();
  return sources.find((s) => s.id === id) ?? null;
}

export function sourcePathFor(source: VideoSource): string {
  return join(VIDEO_EDITOR_SOURCES_DIR, source.fileName);
}

export function exportPathFor(fileName: string): string {
  return join(VIDEO_EDITOR_EXPORTS_DIR, fileName);
}

export async function createRenderResult(params: {
  projectId: string;
  outputPath: string;
  metadata: VideoMetadata;
}): Promise<RenderResult> {
  const fileStat = await stat(params.outputPath);
  const id = crypto.randomUUID();
  const fileName = `${id}.mp4`;
  const finalPath = exportPathFor(fileName);
  await rename(params.outputPath, finalPath);

  const render: RenderResult = {
    id,
    projectId: params.projectId,
    createdAt: nowIso(),
    fileName,
    sizeBytes: fileStat.size,
    metadata: params.metadata,
  };

  const renders = await readExports();
  renders.push(render);
  await writeExports(renders);
  return render;
}

export async function getRenderById(id: string): Promise<RenderResult | null> {
  const renders = await readExports();
  return renders.find((r) => r.id === id) ?? null;
}

export function renderPathFor(render: RenderResult): string {
  return exportPathFor(render.fileName);
}

export async function attachSourceToProject(
  projectId: string,
  sourceId: string,
): Promise<VideoEditorProject | null> {
  const source = await getSourceById(sourceId);
  if (!source) return null;
  const nextBlur = defaultBlurForSource(source.metadata);
  const nextTimeline = defaultTimelineForSource(source.metadata);
  return updateProjectById(projectId, {
    sourceId,
    timeline: nextTimeline,
    blur: nextBlur,
    lastRenderId: null,
  });
}
