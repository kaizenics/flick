import { rm } from "node:fs/promises";
import { createSourceFromFile } from "@/lib/video-editor/store";
import { probeVideo } from "@/lib/video-editor/processing";
import { downloadVideo } from "@/lib/reposting/download";

export const runtime = "nodejs";
export const maxDuration = 600;

type Body = {
  url?: string;
};

function guessName(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const leaf = parts[parts.length - 1] ?? "video";
    return `${leaf.replace(/[^a-zA-Z0-9_-]/g, "") || "video"}.mp4`;
  } catch {
    return "video.mp4";
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return Response.json({ error: "url required" }, { status: 400 });
  }

  let tempPath: string | null = null;

  try {
    tempPath = await downloadVideo(rawUrl);
    const metadata = await probeVideo(tempPath);
    const source = await createSourceFromFile({
      kind: "url",
      originalName: guessName(rawUrl),
      mimeType: "video/mp4",
      sourceUrl: rawUrl,
      tempPath,
      metadata,
    });
    return Response.json({ source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "url import failed";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    if (tempPath) await rm(tempPath, { force: true }).catch(() => {});
  }
}
