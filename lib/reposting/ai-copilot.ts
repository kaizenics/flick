import { listCandidates } from "./candidates-store";
import { readResolvedConfig } from "./config-store";
import { listScheduleRecords } from "./schedule-store";
import { extractVideoId, getVideoMeta } from "./youtube";
import { callOpenRouterJson } from "./ai-openrouter";
import {
  getPreflightItem,
  type CaptionVariant,
  type PreflightItemState,
  type SafetyAssessment,
  type SafetyRiskLevel,
  updatePreflightItem,
  upsertPreflightItems,
} from "./ai-preflight-store";
import {
  readCoachReport,
  writeCoachReport,
  type CoachReport,
} from "./ai-coach-store";

export type QueuePreflightInput = {
  url: string;
  caption?: string;
  comment?: string;
};

function canonicalYoutubeUrl(input: string): string {
  const videoId = extractVideoId(input);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : input.trim();
}

function fallbackVariants(title: string, description: string): CaptionVariant[] {
  const shortTitle = title.trim().slice(0, 90);
  const desc = description.trim().slice(0, 120);
  return [
    {
      id: "v1",
      hookType: "curiosity",
      rationale: "Teases payoff to trigger watch-through.",
      text: `Wait for the twist in this one. ${shortTitle} #viral #reels #fyp`,
    },
    {
      id: "v2",
      hookType: "question",
      rationale: "Direct question prompts comments.",
      text: `Would you react the same way? ${shortTitle} #viral #reels #shortvideo`,
    },
    {
      id: "v3",
      hookType: "stakes",
      rationale: "Highlights consequence/stakes for retention.",
      text: `This is exactly why this moment matters: ${desc} #viral #reels #trend`,
    },
  ];
}

function normalizeVariants(raw: unknown, title: string, description: string): CaptionVariant[] {
  if (!raw || typeof raw !== "object") return fallbackVariants(title, description);
  const arr = (raw as { variants?: unknown[] }).variants;
  if (!Array.isArray(arr)) return fallbackVariants(title, description);

  const variants = arr
    .map((item, i): CaptionVariant | null => {
      if (!item || typeof item !== "object") return null;
      const text = String((item as { text?: unknown }).text ?? "").trim();
      if (!text) return null;
      return {
        id: `v${i + 1}`,
        text: text.slice(0, 220),
        hookType: String((item as { hookType?: unknown }).hookType ?? "general")
          .trim()
          .slice(0, 40),
        rationale: String((item as { rationale?: unknown }).rationale ?? "")
          .trim()
          .slice(0, 180),
      };
    })
    .filter((v): v is CaptionVariant => v !== null);

  if (variants.length === 0) return fallbackVariants(title, description);
  while (variants.length < 3) {
    variants.push(fallbackVariants(title, description)[variants.length]);
  }
  return variants.slice(0, 3);
}

async function generateCaptionVariants(args: {
  title: string;
  description: string;
  apiKey?: string;
  model?: string;
}): Promise<CaptionVariant[]> {
  const prompt = `You write Facebook Reel captions for distribution performance.
Generate EXACTLY 3 distinct caption variants for the same clip.
Each variant must be under 130 characters and include 3-4 hashtags.
No dates. No attribution ("video by", "@user"). No false claims.

Return JSON:
{
  "variants":[
    {"text":"...", "hookType":"curiosity|question|stakes|contrarian|direct", "rationale":"..."},
    {"text":"...", "hookType":"...", "rationale":"..."},
    {"text":"...", "hookType":"...", "rationale":"..."}
  ]
}

Source title: ${args.title}
Source description: ${args.description}`;
  try {
    const json = await callOpenRouterJson<{ variants: unknown[] }>({
      apiKey: args.apiKey,
      model: args.model,
      prompt,
    });
    return normalizeVariants(json, args.title, args.description);
  } catch {
    return fallbackVariants(args.title, args.description);
  }
}

function heuristicSafety(caption: string): SafetyAssessment {
  const text = caption.toLowerCase();
  const blockTerms = [
    "kill",
    "suicide",
    "nsfw",
    "nude",
    "drug",
    "hate",
    "terror",
    "scam",
    "fake giveaway",
  ];
  const reviewTerms = ["shock", "fight", "blood", "adult", "gambling", "politic"];
  const hitBlock = blockTerms.filter((term) => text.includes(term));
  const hitReview = reviewTerms.filter((term) => text.includes(term));
  if (hitBlock.length > 0) {
    return {
      riskLevel: "block",
      categories: ["policy-risk"],
      reasons: [`Contains blocked terms: ${hitBlock.join(", ")}`],
      suggestedRewrite: caption.replace(/#\S+/g, "").trim(),
    };
  }
  if (hitReview.length > 0) {
    return {
      riskLevel: "review",
      categories: ["needs-review"],
      reasons: [`Contains sensitive terms: ${hitReview.join(", ")}`],
      suggestedRewrite: caption.replace(/#\S+/g, "").trim(),
    };
  }
  return {
    riskLevel: "safe",
    categories: [],
    reasons: [],
    suggestedRewrite: caption,
  };
}

function normalizeRiskLevel(raw: unknown): SafetyRiskLevel {
  if (raw === "safe" || raw === "review" || raw === "block") return raw;
  return "review";
}

function normalizeSafety(raw: unknown, caption: string): SafetyAssessment {
  if (!raw || typeof raw !== "object") return heuristicSafety(caption);
  const rec = raw as {
    riskLevel?: unknown;
    categories?: unknown[];
    reasons?: unknown[];
    suggestedRewrite?: unknown;
  };
  return {
    riskLevel: normalizeRiskLevel(rec.riskLevel),
    categories: Array.isArray(rec.categories)
      ? rec.categories.map((v) => String(v).trim()).filter(Boolean).slice(0, 8)
      : [],
    reasons: Array.isArray(rec.reasons)
      ? rec.reasons.map((v) => String(v).trim()).filter(Boolean).slice(0, 8)
      : [],
    suggestedRewrite: String(rec.suggestedRewrite ?? caption).trim().slice(0, 260),
  };
}

async function screenSafety(args: {
  caption: string;
  apiKey?: string;
  model?: string;
}): Promise<SafetyAssessment> {
  const prompt = `Classify this Facebook caption risk for reposting compliance.
Return JSON:
{
  "riskLevel": "safe|review|block",
  "categories": ["..."],
  "reasons": ["..."],
  "suggestedRewrite": "..."
}

Caption:
${args.caption}`;
  try {
    const json = await callOpenRouterJson<unknown>({
      apiKey: args.apiKey,
      model: args.model,
      prompt,
    });
    return normalizeSafety(json, args.caption);
  } catch {
    return heuristicSafety(args.caption);
  }
}

function riskScore(level: SafetyRiskLevel): number {
  if (level === "block") return 3;
  if (level === "review") return 2;
  return 1;
}

function pickDefaultVariant(
  variants: CaptionVariant[],
  safetyByVariant: Record<string, SafetyAssessment>,
): CaptionVariant {
  return [...variants].sort((a, b) => {
    const riskDiff =
      riskScore(safetyByVariant[a.id]?.riskLevel ?? "review") -
      riskScore(safetyByVariant[b.id]?.riskLevel ?? "review");
    if (riskDiff !== 0) return riskDiff;
    return a.id.localeCompare(b.id);
  })[0];
}

export async function runAiPreflight(
  accountId: string,
  items: QueuePreflightInput[],
): Promise<PreflightItemState[]> {
  const cfg = await readResolvedConfig(accountId);
  if (!cfg.youtubeApiKey) {
    throw new Error(
      "YouTube API key is not configured. Add it in Shared settings before running AI Preflight.",
    );
  }
  if (!cfg.openrouterApiKey) {
    throw new Error(
      "OpenRouter API key is not configured. Add it in Shared settings before running AI Preflight.",
    );
  }

  const urls = Array.from(
    new Set(items.map((item) => canonicalYoutubeUrl(item.url)).filter(Boolean)),
  );
  const generatedAt = new Date().toISOString();
  const results: PreflightItemState[] = [];

  for (const url of urls) {
    const videoId = extractVideoId(url);
    if (!videoId) {
      results.push({
        url,
        videoId: "",
        title: "Invalid URL",
        variants: [],
        safetyByVariant: {},
        selectedVariantId: null,
        approvalStatus: "blocked",
        overrideReason: null,
        reviewedAt: null,
        generatedAt,
        blockReasons: ["Invalid YouTube URL"],
      });
      continue;
    }

    const meta = await getVideoMeta(videoId, cfg.youtubeApiKey);
    const variants = await generateCaptionVariants({
      title: meta.title,
      description: meta.description,
      apiKey: cfg.openrouterApiKey,
      model: cfg.openrouterModel,
    });
    const safetyByVariant: Record<string, SafetyAssessment> = {};
    for (const variant of variants) {
      safetyByVariant[variant.id] = await screenSafety({
        caption: variant.text,
        apiKey: cfg.openrouterApiKey,
        model: cfg.openrouterModel,
      });
    }
    const selected = pickDefaultVariant(variants, safetyByVariant);
    const selectedSafety = safetyByVariant[selected.id];
    const blockReasons = (selectedSafety?.reasons ?? []).slice(0, 4);

    results.push({
      url,
      videoId,
      title: meta.title,
      variants,
      safetyByVariant,
      selectedVariantId: selected.id,
      approvalStatus: "pending",
      overrideReason: null,
      reviewedAt: null,
      generatedAt,
      blockReasons:
        selectedSafety?.riskLevel === "safe" ? [] : blockReasons.length ? blockReasons : ["Needs review"],
    });
  }

  await upsertPreflightItems(accountId, results);
  return results;
}

export async function approveAiPreflightItem(args: {
  accountId: string;
  url: string;
  variantId: string;
}): Promise<PreflightItemState> {
  const item = await getPreflightItem(args.accountId, args.url);
  if (!item) throw new Error("preflight-not-found");
  const variantExists = item.variants.some((v) => v.id === args.variantId);
  if (!variantExists) throw new Error("variant-not-found");

  const updated = await updatePreflightItem(args.accountId, args.url, {
    selectedVariantId: args.variantId,
    approvalStatus: "approved",
    overrideReason: null,
    reviewedAt: new Date().toISOString(),
    blockReasons: [],
  });
  if (!updated) throw new Error("preflight-not-found");
  return updated;
}

function classifyBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const h = d.getHours();
  if (h < 6) return "late-night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function fallbackCoach(metrics: CoachReport["metrics"], insufficientData: boolean): Omit<CoachReport, "metrics" | "generatedAt" | "windowStart" | "windowEnd"> {
  if (insufficientData) {
    return {
      insufficientData: true,
      findings: [
        "Not enough 7-day posting data yet for strong pattern learning.",
        "Continue consistent posting to build signal quality.",
      ],
      recommendations: [
        "Keep daily cadence stable for at least 7 days.",
        "Use AI preflight on each queue row to improve caption consistency.",
      ],
      playbook: [
        "Post 3-4 items/day with varied hooks (question, stakes, curiosity).",
        "Review blocked captions and override only when clearly safe.",
      ],
    };
  }
  return {
    findings: [
      `Posted ${metrics.posted} item(s) with ${metrics.failed} failed in last 7 days.`,
      `Best activity window appears to be ${metrics.timeBuckets[0]?.bucket ?? "mixed"}.`,
    ],
    recommendations: [
      "Increase consistency in your best-performing time bucket.",
      "Prefer concise captions with focused hashtag sets.",
    ],
    playbook: [
      "Run Viral Finder daily, then AI preflight before scheduling.",
      "Use one hook style per caption and avoid mixed messaging.",
      "Refresh weekly insights every 2-3 days to track trend shifts.",
    ],
  };
}

export async function generateAiCoachReport(accountId: string): Promise<CoachReport> {
  const cfg = await readResolvedConfig(accountId);
  if (!cfg.openrouterApiKey) {
    throw new Error(
      "OpenRouter API key is not configured. Add it in Shared settings before using AI Coach.",
    );
  }

  const now = Date.now();
  const windowEnd = new Date(now).toISOString();
  const windowStartTs = now - 7 * 24 * 60 * 60 * 1000;
  const windowStart = new Date(windowStartTs).toISOString();

  const [recordsAll, candidates] = await Promise.all([
    listScheduleRecords(accountId),
    listCandidates(accountId),
  ]);

  const records = recordsAll.filter((r) => {
    const t = Date.parse(r.createdAt || r.scheduledAt);
    return Number.isFinite(t) && t >= windowStartTs;
  });

  const channelByUrl = new Map(
    candidates.map((c) => [canonicalYoutubeUrl(c.url), c.channelTitle || "Unknown"]),
  );
  const topChannelMap = new Map<string, number>();
  const bucketMap = new Map<string, number>();
  const captionLengths: number[] = [];
  const hashtagCounts: number[] = [];

  for (const rec of records) {
    const ch = channelByUrl.get(canonicalYoutubeUrl(rec.url)) || "Unknown";
    topChannelMap.set(ch, (topChannelMap.get(ch) ?? 0) + 1);
    const bucket = classifyBucket(rec.scheduledAt || rec.createdAt);
    bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);
    const caption = rec.caption || "";
    captionLengths.push(caption.length);
    const tags = caption.match(/#[A-Za-z0-9_]+/g) ?? [];
    hashtagCounts.push(tags.length);
  }

  const metrics: CoachReport["metrics"] = {
    total: records.length,
    posted: records.filter((r) => r.status === "posted").length,
    scheduled: records.filter((r) => r.status === "scheduled").length,
    failed: records.filter((r) => r.status === "failed").length,
    deleted: records.filter((r) => r.status === "deleted").length,
    avgCaptionLength: avg(captionLengths),
    avgHashtags: avg(hashtagCounts),
    topChannels: Array.from(topChannelMap.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    timeBuckets: Array.from(bucketMap.entries())
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => b.count - a.count),
  };

  const insufficientData = records.length < 3;
  let aiPart: {
    findings: string[];
    recommendations: string[];
    playbook: string[];
  };

  if (insufficientData) {
    aiPart = fallbackCoach(metrics, true);
  } else {
    const prompt = `You are a social video growth coach.
Given 7-day local proxy metrics, produce concise practical advice.
Return JSON with arrays:
{
  "findings": ["..."],
  "recommendations": ["..."],
  "playbook": ["..."]
}
Each array should have 3-5 short bullet strings.
Avoid guarantees. No fluff.

Metrics:
${JSON.stringify(metrics, null, 2)}`;
    try {
      const parsed = await callOpenRouterJson<{
        findings?: unknown[];
        recommendations?: unknown[];
        playbook?: unknown[];
      }>({
        apiKey: cfg.openrouterApiKey,
        model: cfg.openrouterModel,
        prompt,
      });
      const read = (arr: unknown[] | undefined): string[] =>
        Array.isArray(arr)
          ? arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
          : [];
      const findings = read(parsed.findings);
      const recommendations = read(parsed.recommendations);
      const playbook = read(parsed.playbook);
      if (findings.length && recommendations.length && playbook.length) {
        aiPart = { findings, recommendations, playbook };
      } else {
        aiPart = fallbackCoach(metrics, false);
      }
    } catch {
      aiPart = fallbackCoach(metrics, false);
    }
  }

  const report: CoachReport = {
    generatedAt: new Date().toISOString(),
    windowStart,
    windowEnd,
    metrics,
    findings: aiPart.findings,
    recommendations: aiPart.recommendations,
    playbook: aiPart.playbook,
    ...(insufficientData ? { insufficientData: true } : {}),
  };
  await writeCoachReport(accountId, report);
  return report;
}

export async function getAiCoachReport(
  accountId: string,
): Promise<CoachReport | null> {
  return readCoachReport(accountId);
}
