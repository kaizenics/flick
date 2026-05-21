import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { accountDir } from "./accounts-store";
import { extractVideoId } from "./youtube";

export type SafetyRiskLevel = "safe" | "review" | "block";
export type PreflightApprovalStatus =
  | "pending"
  | "approved"
  | "blocked"
  | "overridden";

export type CaptionVariant = {
  id: string;
  text: string;
  hookType: string;
  rationale: string;
};

export type SafetyAssessment = {
  riskLevel: SafetyRiskLevel;
  categories: string[];
  reasons: string[];
  suggestedRewrite: string;
};

export type PreflightItemState = {
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

type FileShape = { items: PreflightItemState[] };

function filePath(accountId: string): string {
  return join(accountDir(accountId), "ai-preflight.json");
}

function normalizeYoutubeUrl(input: string): string {
  const videoId = extractVideoId(input);
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  return input.trim();
}

async function readFileSafe(accountId: string): Promise<PreflightItemState[]> {
  try {
    const text = await readFile(filePath(accountId), "utf8");
    const parsed = JSON.parse(text) as FileShape | PreflightItemState[];
    const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    return items
      .map((item) => ({ ...item, url: normalizeYoutubeUrl(item.url) }))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeFileSafe(accountId: string, items: PreflightItemState[]): Promise<void> {
  await mkdir(accountDir(accountId), { recursive: true });
  await writeFile(filePath(accountId), JSON.stringify({ items }, null, 2) + "\n");
}

export async function listPreflightItems(
  accountId: string,
): Promise<PreflightItemState[]> {
  return readFileSafe(accountId);
}

export async function getPreflightItem(
  accountId: string,
  url: string,
): Promise<PreflightItemState | null> {
  const key = normalizeYoutubeUrl(url);
  const items = await readFileSafe(accountId);
  return items.find((item) => normalizeYoutubeUrl(item.url) === key) ?? null;
}

export async function upsertPreflightItems(
  accountId: string,
  incoming: PreflightItemState[],
): Promise<PreflightItemState[]> {
  const existing = await readFileSafe(accountId);
  const byUrl = new Map(
    existing.map((item) => [normalizeYoutubeUrl(item.url), item]),
  );
  for (const item of incoming) {
    const key = normalizeYoutubeUrl(item.url);
    const prev = byUrl.get(key);
    byUrl.set(key, {
      ...prev,
      ...item,
      url: key,
    });
  }
  const merged = Array.from(byUrl.values()).sort((a, b) =>
    b.generatedAt.localeCompare(a.generatedAt),
  );
  await writeFileSafe(accountId, merged);
  return merged;
}

export async function updatePreflightItem(
  accountId: string,
  url: string,
  patch: Partial<PreflightItemState>,
): Promise<PreflightItemState | null> {
  const key = normalizeYoutubeUrl(url);
  const items = await readFileSafe(accountId);
  const idx = items.findIndex((item) => normalizeYoutubeUrl(item.url) === key);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, url: key };
  await writeFileSafe(accountId, items);
  return items[idx];
}
