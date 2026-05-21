import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";

type WorkflowData = {
  nodes: unknown[];
  edges: unknown[];
};

export type WorkflowRecord = {
  id: string;
  name: string;
  data: WorkflowData;
  createdAt: number;
  updatedAt: number;
};

const WORKFLOWS_FILE = join(process.cwd(), "data", "workflows.json");

const EMPTY_DATA: WorkflowData = {
  nodes: [],
  edges: [],
};

async function ensureStore(): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  try {
    await readFile(WORKFLOWS_FILE, "utf8");
  } catch {
    await writeFile(WORKFLOWS_FILE, JSON.stringify({ items: [] }, null, 2) + "\n");
  }
}

async function readStore(): Promise<WorkflowRecord[]> {
  await ensureStore();
  try {
    const raw = await readFile(WORKFLOWS_FILE, "utf8");
    const parsed = JSON.parse(raw) as { items?: WorkflowRecord[] } | WorkflowRecord[];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;
    return [];
  } catch {
    return [];
  }
}

async function writeStore(items: WorkflowRecord[]): Promise<void> {
  await ensureStore();
  await writeFile(WORKFLOWS_FILE, JSON.stringify({ items }, null, 2) + "\n");
}

export async function listWorkflowsMeta(): Promise<Array<{ id: string; name: string; updatedAt: number }>> {
  const items = await readStore();
  return items
    .map((w) => ({ id: w.id, name: w.name, updatedAt: w.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createWorkflow(input?: {
  name?: string;
  data?: WorkflowData;
}): Promise<{ id: string; name: string; updatedAt: number }> {
  const items = await readStore();
  const now = Date.now();
  const next: WorkflowRecord = {
    id: crypto.randomUUID(),
    name: input?.name?.trim() || "Untitled workflow",
    data: input?.data ?? EMPTY_DATA,
    createdAt: now,
    updatedAt: now,
  };
  items.push(next);
  await writeStore(items);
  return { id: next.id, name: next.name, updatedAt: next.updatedAt };
}

export async function getWorkflowById(id: string): Promise<{
  id: string;
  name: string;
  data: WorkflowData;
  updatedAt: number;
} | null> {
  const items = await readStore();
  const found = items.find((w) => w.id === id);
  if (!found) return null;
  return {
    id: found.id,
    name: found.name,
    data: found.data ?? EMPTY_DATA,
    updatedAt: found.updatedAt,
  };
}

export async function updateWorkflowById(
  id: string,
  patch: { name?: string; data?: WorkflowData },
): Promise<{ updatedAt: number } | null> {
  const items = await readStore();
  const idx = items.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  const now = Date.now();
  const next = { ...items[idx] };
  if (typeof patch.name === "string") next.name = patch.name;
  if (patch.data) next.data = patch.data;
  next.updatedAt = now;
  items[idx] = next;
  await writeStore(items);
  return { updatedAt: now };
}

export async function deleteWorkflowById(id: string): Promise<boolean> {
  const items = await readStore();
  const filtered = items.filter((w) => w.id !== id);
  if (filtered.length === items.length) return false;
  await writeStore(filtered);
  return true;
}
