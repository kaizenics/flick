import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export async function postVideoToFacebookPage(args: {
  pageId: string;
  pageAccessToken: string;
  filePath: string;
  description: string;
  scheduledPublishTime?: number;
}): Promise<string> {
  const { pageId, pageAccessToken, filePath, description, scheduledPublishTime } = args;
  const buf = await readFile(filePath);
  const blob = new Blob([new Uint8Array(buf)], { type: "video/mp4" });

  const form = new FormData();
  form.append("source", blob, basename(filePath));
  form.append("description", description);
  form.append("access_token", pageAccessToken);

  if (scheduledPublishTime) {
    form.append("published", "false");
    form.append("scheduled_publish_time", String(scheduledPublishTime));
  }

  const res = await fetch(`https://graph-video.facebook.com/v21.0/${pageId}/videos`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Facebook upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string; post_id?: string };
  return data.post_id ?? data.id ?? "unknown";
}

export async function commentOnFacebookPost(args: {
  postId: string;
  pageAccessToken: string;
  message: string;
}): Promise<string> {
  const body = new URLSearchParams({
    message: args.message,
    access_token: args.pageAccessToken,
  });
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${args.postId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Facebook comment failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? "unknown";
}
