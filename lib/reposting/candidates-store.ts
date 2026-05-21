import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { accountDir } from "./accounts-store";
import type { YoutubeDiscoveredCandidate } from "./youtube-discovery";

export type StoredCandidate = YoutubeDiscoveredCandidate & {
  firstSeenAt: string;
  lastSeenAt: string;
};

function candidatesFile(accountId: string): string {
  return join(accountDir(accountId), "candidates.json");
}

async function readCandidates(accountId: string): Promise<StoredCandidate[]> {
  try {
    const text = await readFile(candidatesFile(accountId), "utf8");
    const parsed = JSON.parse(text) as { items?: StoredCandidate[] } | StoredCandidate[];
    const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    return items.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeCandidates(accountId: string, items: StoredCandidate[]): Promise<void> {
  const file = candidatesFile(accountId);
  await mkdir(accountDir(accountId), { recursive: true });
  await writeFile(file, JSON.stringify({ items }, null, 2) + "\n");
}

export async function listCandidates(accountId: string): Promise<StoredCandidate[]> {
  return readCandidates(accountId);
}

export async function clearCandidates(accountId: string): Promise<void> {
  await rm(candidatesFile(accountId), { force: true });
}

export async function upsertCandidates(
  accountId: string,
  incoming: YoutubeDiscoveredCandidate[],
): Promise<{ items: StoredCandidate[]; added: number; updated: number }> {
  const current = await readCandidates(accountId);
  const byUrl = new Map(current.map((c) => [c.url, c]));
  let added = 0;
  let updated = 0;

  for (const item of incoming) {
    const existing = byUrl.get(item.url);
    if (!existing) {
      added += 1;
      byUrl.set(item.url, {
        ...item,
        firstSeenAt: item.discoveredAt,
        lastSeenAt: item.discoveredAt,
      });
      continue;
    }
    updated += 1;
    byUrl.set(item.url, {
      ...existing,
      ...item,
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: item.discoveredAt,
      discoveredAt: item.discoveredAt,
    });
  }

  const items = Array.from(byUrl.values()).sort((a, b) =>
    b.lastSeenAt.localeCompare(a.lastSeenAt),
  );
  await writeCandidates(accountId, items);
  return { items, added, updated };
}

