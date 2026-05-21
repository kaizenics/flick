import { getAccount } from "./accounts-store";
import {
  listCandidates,
  type StoredCandidate,
  upsertCandidates,
} from "./candidates-store";
import { listScheduleRecords, type ScheduledRecord } from "./schedule-store";
import {
  discoverYoutubeCandidates,
  type YoutubeDiscoveredCandidate,
} from "./youtube-discovery";
import type { ViralProfile } from "./viral-profile-store";

export type ViralScoreBreakdown = {
  velocity: number;
  freshness: number;
  engagement: number;
  relevance: number;
  feedback: number;
  total: number;
};

export type ScoredCandidate = StoredCandidate & {
  viralScore: number;
  scoreBreakdown: ViralScoreBreakdown;
  matchedKeywords: string[];
  sourceQuery: string;
  channelStatsSnapshot: {
    posted: number;
    failed: number;
    totalSeen: number;
  };
  lastEvaluatedAt: string;
};

function canonicalYoutubeUrl(input: string): string {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }
  try {
    const u = new URL(trimmed);
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) {
      return `https://www.youtube.com/watch?v=${v}`;
    }
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
        return `https://www.youtube.com/watch?v=${id}`;
      }
    }
  } catch {
    // keep original
  }
  return trimmed;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^a-z0-9]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function uniqueNonEmpty(inputs: string[]): string[] {
  return Array.from(
    new Set(
      inputs
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export function buildQueryTemplates(profile: ViralProfile): string[] {
  const seeds = uniqueNonEmpty(profile.seedKeywords).slice(0, 8);
  const niche = profile.niche.trim();
  const audience = profile.audience.trim();
  const base = uniqueNonEmpty([niche, ...seeds]).slice(0, 8);
  if (base.length === 0) return ["viral shorts"];

  const queries = new Set<string>();
  for (const token of base) {
    queries.add(`${token} shorts`);
    queries.add(`${token} trending shorts`);
    if (audience) queries.add(`${token} ${audience} shorts`);
  }
  if (niche && audience) {
    queries.add(`${niche} ${audience} viral shorts`);
  }
  if (profile.language.trim()) {
    queries.add(`${niche || seeds[0] || "viral"} ${profile.language.trim()} shorts`);
  }
  return Array.from(queries).slice(0, 8);
}

function isExcluded(
  candidate: YoutubeDiscoveredCandidate,
  excludeKeywords: string[],
): boolean {
  if (excludeKeywords.length === 0) return false;
  const hay = `${candidate.title} ${candidate.channelTitle}`.toLowerCase();
  return excludeKeywords.some((kw) => kw && hay.includes(kw.toLowerCase()));
}

function scoreFromVelocity(viewCount: number, ageHours: number): number {
  const velocity = viewCount / Math.max(ageHours, 2);
  const normalized = Math.log10(velocity + 1) / Math.log10(30000 + 1);
  return clamp(normalized * 40, 0, 40);
}

function scoreFromFreshness(ageHours: number): number {
  const ageDays = ageHours / 24;
  const decay = 1 - clamp(ageDays / 14, 0, 1);
  return decay * 25;
}

function scoreFromEngagement(viewCount: number, likeCount: number): number {
  if (viewCount <= 0 || likeCount <= 0) return 0;
  const ratio = likeCount / viewCount;
  const normalized = clamp(ratio / 0.08, 0, 1);
  return normalized * 15;
}

type Feedback = {
  byUrl: Map<string, number>;
  byChannel: Map<string, { posted: number; failed: number }>;
};

function buildFeedback(
  records: ScheduledRecord[],
  existing: StoredCandidate[],
): Feedback {
  const byUrl = new Map<string, number>();
  const byChannel = new Map<string, { posted: number; failed: number }>();
  const channelByUrl = new Map(
    existing.map((c) => [canonicalYoutubeUrl(c.url), c.channelTitle || ""]),
  );

  for (const record of records) {
    const url = canonicalYoutubeUrl(record.url);
    const current = byUrl.get(url) ?? 0;
    if (record.status === "posted") byUrl.set(url, current + 2);
    else if (record.status === "failed") byUrl.set(url, current - 2);
    else if (record.status === "deleted") byUrl.set(url, current - 1);

    const channelName = channelByUrl.get(url);
    if (!channelName) continue;
    const stats = byChannel.get(channelName) ?? { posted: 0, failed: 0 };
    if (record.status === "posted") stats.posted += 1;
    if (record.status === "failed") stats.failed += 1;
    byChannel.set(channelName, stats);
  }

  return { byUrl, byChannel };
}

function scoreFeedback(
  candidate: YoutubeDiscoveredCandidate,
  feedback: Feedback,
): { score: number; channelSnapshot: { posted: number; failed: number; totalSeen: number } } {
  const urlScore = feedback.byUrl.get(canonicalYoutubeUrl(candidate.url)) ?? 0;
  const channelStats = feedback.byChannel.get(candidate.channelTitle) ?? {
    posted: 0,
    failed: 0,
  };
  const totalSeen = channelStats.posted + channelStats.failed;
  const channelBias =
    totalSeen === 0 ? 0 : ((channelStats.posted - channelStats.failed) / totalSeen) * 8;
  return {
    score: clamp(urlScore + channelBias, -10, 10),
    channelSnapshot: { ...channelStats, totalSeen },
  };
}

function scoreRelevance(
  candidate: YoutubeDiscoveredCandidate,
  profile: ViralProfile,
): { score: number; matched: string[] } {
  const keywords = uniqueNonEmpty([
    profile.niche,
    profile.audience,
    profile.language,
    ...profile.seedKeywords,
  ]);
  if (keywords.length === 0) return { score: 0, matched: [] };
  const hay = normalizeText(`${candidate.title} ${candidate.channelTitle}`);
  const matched = keywords.filter((kw) => hay.includes(kw.toLowerCase())).slice(0, 12);
  const score = clamp((matched.length / Math.max(keywords.length, 1)) * 20, 0, 20);
  return { score, matched };
}

function scoreCandidate(
  candidate: YoutubeDiscoveredCandidate,
  profile: ViralProfile,
  feedback: Feedback,
): {
  viralScore: number;
  scoreBreakdown: ViralScoreBreakdown;
  matchedKeywords: string[];
  sourceQuery: string;
  channelStatsSnapshot: {
    posted: number;
    failed: number;
    totalSeen: number;
  };
  lastEvaluatedAt: string;
} {
  const publishedTs = Date.parse(candidate.publishedAt);
  const ageHours = Number.isFinite(publishedTs)
    ? Math.max((Date.now() - publishedTs) / 3_600_000, 1)
    : 72;

  const velocity = scoreFromVelocity(candidate.viewCount, ageHours);
  const freshness = scoreFromFreshness(ageHours);
  const engagement = scoreFromEngagement(candidate.viewCount, candidate.likeCount);
  const relevance = scoreRelevance(candidate, profile);
  const feedbackData = scoreFeedback(candidate, feedback);
  const total = clamp(
    Math.round(
      velocity + freshness + engagement + relevance.score + (feedbackData.score + 10) * 0.5,
    ),
    0,
    100,
  );

  return {
    viralScore: total,
    scoreBreakdown: {
      velocity: Math.round(velocity),
      freshness: Math.round(freshness),
      engagement: Math.round(engagement),
      relevance: Math.round(relevance.score),
      feedback: Math.round(feedbackData.score),
      total,
    },
    matchedKeywords: relevance.matched,
    sourceQuery: "",
    channelStatsSnapshot: feedbackData.channelSnapshot,
    lastEvaluatedAt: new Date().toISOString(),
  };
}

function mapCapByAccountAge(createdAt: string): number {
  const createdTs = Date.parse(createdAt);
  if (!Number.isFinite(createdTs)) return 3;
  const day = Math.floor((Date.now() - createdTs) / 86_400_000) + 1;
  if (day <= 2) return 3;
  if (day <= 4) return 4;
  if (day <= 6) return 5;
  return 6;
}

export async function runViralDiscovery(params: {
  accountId: string;
  profile: ViralProfile;
  apiKey?: string;
  maxResults?: number;
  freshnessDays?: number;
}): Promise<{ items: ScoredCandidate[]; added: number; updated: number; queries: string[] }> {
  const { accountId, profile, apiKey } = params;
  const maxResults = clamp(Math.floor(Number(params.maxResults ?? 20)), 1, 25);
  const freshnessDays = clamp(Math.floor(Number(params.freshnessDays ?? 7)), 1, 365);
  const queries = buildQueryTemplates(profile);
  const batches = await Promise.all(
    queries.map(async (query) => {
      const items = await discoverYoutubeCandidates({
        query,
        maxResults,
        freshnessDays,
        apiKey,
      });
      return { query, items };
    }),
  );

  const merged = new Map<string, YoutubeDiscoveredCandidate & { sourceQuery: string }>();
  for (const batch of batches) {
    for (const item of batch.items) {
      if (isExcluded(item, profile.excludeKeywords)) continue;
      const url = canonicalYoutubeUrl(item.url);
      const existing = merged.get(url);
      if (!existing || item.viewCount > existing.viewCount) {
        merged.set(url, { ...item, url, sourceQuery: batch.query });
      }
    }
  }

  const existing = await listCandidates(accountId);
  const history = await listScheduleRecords(accountId);
  const feedback = buildFeedback(history, existing);

  const scored = Array.from(merged.values())
    .map((item) => {
      const score = scoreCandidate(item, profile, feedback);
      return {
        ...item,
        ...score,
        sourceQuery: item.sourceQuery,
      };
    })
    .sort((a, b) => b.viralScore - a.viralScore || b.viewCount - a.viewCount);

  const result = await upsertCandidates(accountId, scored);
  const items = result.items as ScoredCandidate[];
  return { ...result, items, queries };
}

export async function selectTopCandidatesForAppend(params: {
  accountId: string;
  minViralScore: number;
  existingTodayCount: number;
  queueUrls?: string[];
  limit?: number;
}): Promise<{
  selectedUrls: string[];
  cap: number;
  remainingSlots: number;
  considered: number;
  skipped: { lowScore: number; duplicate: number; capLimited: number };
}> {
  const account = await getAccount(params.accountId);
  if (!account) throw new Error("not-found");

  const cap = mapCapByAccountAge(account.createdAt);
  const remainingSlots = Math.max(0, cap - Math.max(0, params.existingTodayCount));
  const maxTake =
    params.limit && Number.isFinite(params.limit)
      ? Math.max(0, Math.min(50, Math.floor(params.limit)))
      : remainingSlots;

  const candidates = (await listCandidates(params.accountId)) as ScoredCandidate[];
  const records = await listScheduleRecords(params.accountId);
  const historySet = new Set(records.map((r) => canonicalYoutubeUrl(r.url)));
  const queueSet = new Set((params.queueUrls ?? []).map(canonicalYoutubeUrl));

  let lowScore = 0;
  let duplicate = 0;
  let capLimited = 0;
  const selected: string[] = [];

  for (const item of candidates.sort((a, b) => (b.viralScore ?? 0) - (a.viralScore ?? 0))) {
    const score = Number(item.viralScore ?? 0);
    if (score < params.minViralScore) {
      lowScore += 1;
      continue;
    }
    const url = canonicalYoutubeUrl(item.url);
    if (historySet.has(url) || queueSet.has(url) || selected.includes(url)) {
      duplicate += 1;
      continue;
    }
    if (selected.length >= remainingSlots || selected.length >= maxTake) {
      capLimited += 1;
      continue;
    }
    selected.push(url);
  }

  return {
    selectedUrls: selected,
    cap,
    remainingSlots,
    considered: candidates.length,
    skipped: { lowScore, duplicate, capLimited },
  };
}
