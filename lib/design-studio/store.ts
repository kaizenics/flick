import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";

// One JSON file per design: docs embed uploaded images as data URLs, so a shared index would get huge.
export const DESIGN_STUDIO_DIR = join(process.cwd(), "data", "design-studio", "designs");

const MAX_NAME_LENGTH = 80;
const MIN_SIDE = 16;
const MAX_SIDE = 8000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Design = {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  // Fabric canvas JSON; opaque to the server.
  doc: Record<string, unknown> | null;
};

export type DesignSummary = Omit<Design, "doc">;

export function normalizeName(name?: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed ? trimmed.slice(0, MAX_NAME_LENGTH) : "Untitled design";
}

export function normalizeSide(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(MAX_SIDE, Math.max(MIN_SIDE, n)));
}

// Guards the id before it becomes a file path.
function fileFor(id: string): string | null {
  return UUID_RE.test(id) ? join(DESIGN_STUDIO_DIR, `${id}.json`) : null;
}

async function writeDesign(design: Design): Promise<void> {
  await mkdir(DESIGN_STUDIO_DIR, { recursive: true });
  await writeFile(fileFor(design.id)!, JSON.stringify(design) + "\n", "utf8");
}

export async function getDesign(id: string): Promise<Design | null> {
  const path = fileFor(id);
  if (!path) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as Design;
  } catch {
    return null;
  }
}

export async function listDesigns(): Promise<DesignSummary[]> {
  await mkdir(DESIGN_STUDIO_DIR, { recursive: true });
  const files = (await readdir(DESIGN_STUDIO_DIR)).filter((f) => f.endsWith(".json"));
  const designs = await Promise.all(files.map((f) => getDesign(f.slice(0, -5))));
  return designs
    .filter((d): d is Design => d !== null)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ doc: _doc, ...summary }) => summary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createDesign(input: { name?: unknown; width?: unknown; height?: unknown }): Promise<Design> {
  const now = new Date().toISOString();
  const design: Design = {
    id: crypto.randomUUID(),
    name: normalizeName(input.name),
    width: normalizeSide(input.width, 1080),
    height: normalizeSide(input.height, 1080),
    createdAt: now,
    updatedAt: now,
    doc: null,
  };
  await writeDesign(design);
  return design;
}

export async function updateDesign(
  id: string,
  patch: { name?: unknown; width?: unknown; height?: unknown; doc?: unknown },
): Promise<Design | null> {
  const current = await getDesign(id);
  if (!current) return null;
  const next: Design = { ...current, updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) next.name = normalizeName(patch.name);
  if (patch.width !== undefined) next.width = normalizeSide(patch.width, current.width);
  if (patch.height !== undefined) next.height = normalizeSide(patch.height, current.height);
  if (patch.doc !== undefined) {
    next.doc = patch.doc && typeof patch.doc === "object" && !Array.isArray(patch.doc)
      ? (patch.doc as Record<string, unknown>)
      : null;
  }
  await writeDesign(next);
  return next;
}

export async function deleteDesign(id: string): Promise<boolean> {
  const path = fileFor(id);
  if (!path || !(await getDesign(id))) return false;
  await rm(path, { force: true });
  return true;
}
