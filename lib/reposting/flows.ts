import { rm } from "node:fs/promises";
import type { Flow } from "./accounts-store";
import { readResolvedConfig } from "./config-store";
import { downloadVideo } from "./download";
import { generateCaption, generateYoutubeMeta } from "./caption";
import { extractVideoId, getVideoMeta } from "./youtube";
import { extractReelId, getReelMeta } from "./instagram";
import { extractTiktokId, getTiktokMeta } from "./tiktok";
import { postVideoToFacebookPage, commentOnFacebookPost } from "./facebook";
import { uploadToYoutube } from "./youtube-upload";

export type FlowEvent = {
  step: "metadata" | "download" | "caption" | "upload" | "done" | "error";
  message: string;
  caption?: string;
  postId?: string;
};

export type RunItemArgs = {
  accountId: string;
  flow: Flow;
  url: string;
  scheduledAt?: string;
  publishNow?: boolean;
  fbPageId?: string;
  /** Optional manual caption — when provided, AI generation is skipped. */
  manualCaption?: string;
  /** Optional first comment to post under the video after upload (FB destinations only). */
  comment?: string;
  send: (e: FlowEvent) => void;
};

export type RunItemResult = {
  postId: string;
  videoId: string;
  caption: string;
  status: "scheduled" | "posted";
  destinationPageId: string;
};

const MIN_LEAD_MS = 11 * 60 * 1000;
const MAX_LEAD_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function parseSchedule(args: RunItemArgs): {
  scheduledTs?: number;
  scheduledIso?: string;
  isScheduled: boolean;
} {
  if (args.publishNow) return { isScheduled: false };
  if (!args.scheduledAt) throw new Error("scheduledAt required when publishNow is false");
  const t = new Date(args.scheduledAt).getTime();
  if (Number.isNaN(t)) throw new Error(`Invalid scheduledAt: ${args.scheduledAt}`);
  const lead = t - Date.now();
  if (lead < MIN_LEAD_MS)
    throw new Error("Scheduled time must be at least 11 minutes in the future");
  if (lead > MAX_LEAD_MS) throw new Error("Scheduled time must be within 6 months");
  return {
    scheduledTs: Math.floor(t / 1000),
    scheduledIso: new Date(t).toISOString(),
    isScheduled: true,
  };
}

export async function runItem(args: RunItemArgs): Promise<RunItemResult> {
  const { send, flow, accountId, url } = args;
  const cfg = await readResolvedConfig(accountId);
  const sched = parseSchedule(args);
  let filePath: string | null = null;

  try {
    if (flow === "yt-to-fb") {
      if (!args.fbPageId) throw new Error("fbPageId required for yt-to-fb");
      if (!cfg.fbPageAccessToken)
        throw new Error("Facebook Page Access Token not configured for this account");
      if (!cfg.youtubeApiKey)
        throw new Error("YouTube API key not configured — set it in Shared settings");
      const videoId = extractVideoId(url);
      if (!videoId) throw new Error(`Invalid YouTube URL: ${url}`);

      send({ step: "metadata", message: "Fetching YouTube metadata" });
      const meta = await getVideoMeta(videoId, cfg.youtubeApiKey);

      send({ step: "download", message: `Downloading "${meta.title}"` });
      filePath = await downloadVideo(url);

      send({ step: "caption", message: "Generating caption" });
      const caption = await generateCaption({
        title: meta.title,
        description: meta.description,
        apiKey: cfg.openrouterApiKey,
        model: cfg.openrouterModel,
        bannedHashtags: ["shorts", "shortsfeed"],
      });

      send({
        step: "upload",
        message: sched.isScheduled
          ? "Uploading and scheduling on Facebook"
          : "Uploading to Facebook",
        caption,
      });
      const fbPostId = await postVideoToFacebookPage({
        pageId: args.fbPageId,
        pageAccessToken: cfg.fbPageAccessToken,
        filePath,
        description: caption,
        scheduledPublishTime: sched.scheduledTs,
      });

      if (args.comment?.trim()) {
        try {
          send({ step: "upload", message: "Posting first comment" });
          await commentOnFacebookPost({
            postId: fbPostId,
            pageAccessToken: cfg.fbPageAccessToken,
            message: args.comment.trim(),
          });
        } catch (e) {
          send({
            step: "error",
            message: `Comment failed: ${e instanceof Error ? e.message : "unknown"}`,
          });
        }
      }

      send({
        step: "done",
        message: sched.isScheduled
          ? `Scheduled (id ${fbPostId})`
          : `Posted (id ${fbPostId})`,
        postId: fbPostId,
        caption,
      });

      return {
        postId: fbPostId,
        videoId,
        caption,
        status: sched.isScheduled ? "scheduled" : "posted",
        destinationPageId: args.fbPageId,
      };
    }

    if (flow === "ig-to-yt") {
      const reelId = extractReelId(url);
      if (!reelId) throw new Error(`Invalid Instagram Reel URL: ${url}`);

      send({ step: "metadata", message: "Fetching Instagram metadata" });
      const meta = await getReelMeta(url);

      send({ step: "download", message: `Downloading reel by ${meta.uploader ?? "unknown"}` });
      filePath = await downloadVideo(url);

      send({ step: "caption", message: "Generating YouTube title + description" });
      const ytMeta = await generateYoutubeMeta({
        title: meta.title,
        description: meta.description,
        apiKey: cfg.openrouterApiKey,
        model: cfg.openrouterModel,
      });
      const caption = ytMeta.description;

      send({
        step: "upload",
        message: sched.isScheduled
          ? `Uploading and scheduling on YouTube — "${ytMeta.title}"`
          : `Uploading to YouTube — "${ytMeta.title}"`,
        caption,
      });
      const yt = await uploadToYoutube({
        accountId,
        filePath,
        title: ytMeta.title,
        description: ytMeta.description,
        tags: ytMeta.tags,
        scheduledPublishAt: sched.scheduledIso,
      });

      send({
        step: "done",
        message: sched.isScheduled
          ? `Scheduled on YouTube (id ${yt.videoId})`
          : `Uploaded to YouTube (id ${yt.videoId})`,
        postId: yt.videoId,
        caption,
      });

      return {
        postId: yt.videoId,
        videoId: reelId,
        caption,
        status: sched.isScheduled ? "scheduled" : "posted",
        destinationPageId: "youtube",
      };
    }

    if (flow === "tt-to-fb") {
      if (!args.fbPageId) throw new Error("fbPageId required for tt-to-fb");
      if (!cfg.fbPageAccessToken)
        throw new Error("Facebook Page Access Token not configured for this account");
      const ttId = extractTiktokId(url);
      if (!ttId) throw new Error(`Invalid TikTok URL: ${url}`);

      send({ step: "metadata", message: "Fetching TikTok metadata" });
      const meta = await getTiktokMeta(url);

      send({ step: "download", message: `Downloading TikTok by ${meta.uploader ?? "unknown"}` });
      filePath = await downloadVideo(url);

      let caption = args.manualCaption?.trim();
      if (caption) {
        send({ step: "caption", message: "Using your caption" });
      } else {
        send({ step: "caption", message: "Generating caption with AI" });
        caption = await generateCaption({
          title: meta.title,
          description: meta.description,
          apiKey: cfg.openrouterApiKey,
          model: cfg.openrouterModel,
        });
      }

      send({
        step: "upload",
        message: sched.isScheduled
          ? "Uploading and scheduling on Facebook"
          : "Uploading to Facebook",
        caption,
      });
      const fbPostId = await postVideoToFacebookPage({
        pageId: args.fbPageId,
        pageAccessToken: cfg.fbPageAccessToken,
        filePath,
        description: caption,
        scheduledPublishTime: sched.scheduledTs,
      });

      if (args.comment?.trim()) {
        try {
          send({ step: "upload", message: "Posting first comment" });
          await commentOnFacebookPost({
            postId: fbPostId,
            pageAccessToken: cfg.fbPageAccessToken,
            message: args.comment.trim(),
          });
        } catch (e) {
          send({
            step: "error",
            message: `Comment failed: ${e instanceof Error ? e.message : "unknown"}`,
          });
        }
      }

      send({
        step: "done",
        message: sched.isScheduled
          ? `Scheduled (id ${fbPostId})`
          : `Posted (id ${fbPostId})`,
        postId: fbPostId,
        caption,
      });

      return {
        postId: fbPostId,
        videoId: ttId,
        caption,
        status: sched.isScheduled ? "scheduled" : "posted",
        destinationPageId: args.fbPageId,
      };
    }

    throw new Error(`Unknown flow: ${flow}`);
  } finally {
    if (filePath) await rm(filePath, { force: true }).catch(() => {});
  }
}
