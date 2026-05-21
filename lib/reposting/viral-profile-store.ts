import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { accountDir } from "./accounts-store";

export type ViralProfile = {
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

const DEFAULT_PROFILE: ViralProfile = {
  niche: "",
  audience: "",
  language: "",
  seedKeywords: [],
  excludeKeywords: [],
  autoRefreshEnabled: false,
  autoRefreshMinutes: 360,
  minViralScore: 65,
  autoAppendEnabled: false,
};

function profileFile(accountId: string): string {
  return join(accountDir(accountId), "viral-profile.json");
}

function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const dedup = new Set<string>();
  for (const item of raw) {
    const value = String(item ?? "").trim().toLowerCase();
    if (!value) continue;
    dedup.add(value);
  }
  return Array.from(dedup).slice(0, 32);
}

function clampNumber(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function mergeProfile(patch: Partial<ViralProfile>, current = DEFAULT_PROFILE): ViralProfile {
  return {
    niche: String(patch.niche ?? current.niche).trim().slice(0, 120),
    audience: String(patch.audience ?? current.audience).trim().slice(0, 120),
    language: String(patch.language ?? current.language).trim().slice(0, 60),
    seedKeywords: normalizeKeywords(patch.seedKeywords ?? current.seedKeywords),
    excludeKeywords: normalizeKeywords(patch.excludeKeywords ?? current.excludeKeywords),
    autoRefreshEnabled: Boolean(
      patch.autoRefreshEnabled ?? current.autoRefreshEnabled,
    ),
    autoRefreshMinutes: clampNumber(
      patch.autoRefreshMinutes ?? current.autoRefreshMinutes,
      15,
      1440,
      current.autoRefreshMinutes,
    ),
    minViralScore: clampNumber(
      patch.minViralScore ?? current.minViralScore,
      0,
      100,
      current.minViralScore,
    ),
    autoAppendEnabled: Boolean(patch.autoAppendEnabled ?? current.autoAppendEnabled),
  };
}

export async function readViralProfile(accountId: string): Promise<ViralProfile> {
  try {
    const text = await readFile(profileFile(accountId), "utf8");
    const parsed = JSON.parse(text) as Partial<ViralProfile>;
    return mergeProfile(parsed);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_PROFILE;
    throw e;
  }
}

export async function writeViralProfile(
  accountId: string,
  patch: Partial<ViralProfile>,
): Promise<ViralProfile> {
  const current = await readViralProfile(accountId);
  const next = mergeProfile(patch, current);
  const file = profileFile(accountId);
  await mkdir(accountDir(accountId), { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");
  return next;
}
