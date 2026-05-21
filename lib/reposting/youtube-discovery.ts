type YoutubeDiscoveryParams = {
  query: string;
  maxResults: number;
  freshnessDays: number;
  apiKey?: string;
};

export type YoutubeDiscoveredCandidate = {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  thumbUrl: string;
  discoveredAt: string;
};

type YoutubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
  }>;
};

type YoutubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string };
  }>;
};

function canonicalYoutubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function parseIsoDurationToSeconds(raw: string): number {
  const match =
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
      raw,
    );
  if (!match) return Number.POSITIVE_INFINITY;
  const [
    ,
    years,
    months,
    weeks,
    days,
    hours,
    minutes,
    seconds,
  ] = match;
  const total =
    (Number(years || 0) * 365 * 24 * 3600) +
    (Number(months || 0) * 30 * 24 * 3600) +
    (Number(weeks || 0) * 7 * 24 * 3600) +
    (Number(days || 0) * 24 * 3600) +
    (Number(hours || 0) * 3600) +
    (Number(minutes || 0) * 60) +
    Number(seconds || 0);
  return total;
}

function parseCount(raw?: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function discoverYoutubeCandidates(
  params: YoutubeDiscoveryParams,
): Promise<YoutubeDiscoveredCandidate[]> {
  const key = params.apiKey ?? process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY is not configured. Add it in Shared settings or .env.local before using Discover.",
    );
  }

  const query = params.query.trim();
  if (!query) return [];
  const maxResults = Math.max(1, Math.min(25, Math.floor(params.maxResults || 10)));
  const freshnessDays = Math.max(1, Math.min(365, Math.floor(params.freshnessDays || 7)));
  const publishedAfter = new Date(
    Date.now() - freshnessDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set("key", key);

  const searchRes = await fetch(searchUrl, { cache: "no-store" });
  if (!searchRes.ok) {
    throw new Error(
      `YouTube search failed: ${searchRes.status} ${await searchRes.text()}`,
    );
  }
  const searchData = (await searchRes.json()) as YoutubeSearchResponse;
  const ids = Array.from(
    new Set(
      (searchData.items ?? [])
        .map((i) => i.id?.videoId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (ids.length === 0) return [];

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "snippet,contentDetails,statistics");
  videosUrl.searchParams.set("id", ids.join(","));
  videosUrl.searchParams.set("key", key);

  const videosRes = await fetch(videosUrl, { cache: "no-store" });
  if (!videosRes.ok) {
    throw new Error(
      `YouTube videos lookup failed: ${videosRes.status} ${await videosRes.text()}`,
    );
  }
  const videosData = (await videosRes.json()) as YoutubeVideosResponse;
  const discoveredAt = new Date().toISOString();

  const items = (videosData.items ?? [])
    .map((item): YoutubeDiscoveredCandidate | null => {
      const videoId = item.id?.trim();
      if (!videoId) return null;

      const durationSeconds = parseIsoDurationToSeconds(
        item.contentDetails?.duration ?? "",
      );
      if (durationSeconds > 180) return null;

      const title = item.snippet?.title?.trim() ?? "";
      const channelTitle = item.snippet?.channelTitle?.trim() ?? "";
      const publishedAt = item.snippet?.publishedAt ?? discoveredAt;
      const thumbUrl =
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        "";

      return {
        videoId,
        url: canonicalYoutubeUrl(videoId),
        title,
        channelTitle,
        publishedAt,
        durationSeconds,
        viewCount: parseCount(item.statistics?.viewCount),
        likeCount: parseCount(item.statistics?.likeCount),
        thumbUrl,
        discoveredAt,
      };
    })
    .filter((v): v is YoutubeDiscoveredCandidate => v !== null)
    .sort((a, b) => b.viewCount - a.viewCount);

  return items;
}

