import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { searchYoutubeShort } from "@/lib/reposting/youtube";
import { downloadShort } from "@/lib/reposting/download";
import { generateCaption } from "@/lib/reposting/caption";
import { postVideoToFacebookPage } from "@/lib/reposting/facebook";
import { readConfig } from "@/lib/reposting/config-store";
import { rm } from "node:fs/promises";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { query, pageId } = (await req.json().catch(() => ({}))) as {
    query?: string;
    pageId?: string;
  };
  if (!query?.trim() || !pageId?.trim()) {
    return Response.json({ error: "query and pageId required" }, { status: 400 });
  }

  const cfg = await readConfig();
  if (!cfg.fbPageAccessToken) {
    return Response.json(
      { error: "Facebook Page Access Token not configured — set it in Reposting → Settings" },
      { status: 500 }
    );
  }
  const pageAccessToken = cfg.fbPageAccessToken;

  let filePath: string | null = null;
  try {
    const video = await searchYoutubeShort(query, cfg.youtubeApiKey);
    if (!video) {
      return Response.json({ error: "no video found" }, { status: 404 });
    }

    filePath = await downloadShort(video.id);
    const caption = await generateCaption({
      title: video.title,
      description: video.description,
      apiKey: cfg.openrouterApiKey,
      model: cfg.openrouterModel,
    });
    const fbPostId = await postVideoToFacebookPage({
      pageId,
      pageAccessToken,
      filePath,
      description: caption,
    });

    return Response.json({
      videoId: video.id,
      title: video.title,
      caption,
      fbPostId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return new Response(msg, { status: 500 });
  } finally {
    if (filePath) {
      await rm(filePath, { force: true }).catch(() => {});
    }
  }
}
