export type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
};

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // not a URL
  }
  return null;
}

export async function searchYoutubeShort(
  query: string,
  apiKey?: string,
): Promise<YoutubeVideo | null> {
  const key = apiKey ?? process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YouTube API key not configured");

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoDuration", "short");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    items?: Array<{
      id: { videoId: string };
      snippet: { title: string; description: string };
    }>;
  };
  const item = data.items?.[0];
  if (!item) return null;
  return {
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
  };
}

export async function getVideoMeta(videoId: string, apiKey?: string): Promise<YoutubeVideo> {
  const key = apiKey ?? process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YouTube API key not configured");

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube videos.list failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    items?: Array<{ snippet: { title: string; description: string } }>;
  };
  const item = data.items?.[0];
  if (!item) throw new Error(`Video ${videoId} not found or private`);
  return {
    id: videoId,
    title: item.snippet.title,
    description: item.snippet.description,
  };
}
