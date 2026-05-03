import { createReadStream, statSync } from "node:fs";
import { refreshAccessToken, readState } from "./youtube-oauth";

export type YoutubeUploadArgs = {
  accountId: string;
  filePath: string;
  title: string;
  description: string;
  privacyStatus?: "private" | "public" | "unlisted";
  scheduledPublishAt?: string;
  tags?: string[];
};

export async function uploadToYoutube(
  args: YoutubeUploadArgs,
): Promise<{ videoId: string; status: string }> {
  const state = await readState(args.accountId);
  if (!state)
    throw new Error("YouTube not connected for this account — connect via OAuth first");

  const accessToken = await refreshAccessToken(state.refreshToken);
  const stats = statSync(args.filePath);

  const isScheduled = !!args.scheduledPublishAt;
  const snippet = {
    title: args.title.slice(0, 100),
    description: args.description.slice(0, 5000),
    tags: args.tags,
    categoryId: "22",
  };
  const status: Record<string, unknown> = {
    privacyStatus: isScheduled ? "private" : args.privacyStatus ?? "public",
    selfDeclaredMadeForKids: false,
  };
  if (isScheduled) status.publishAt = args.scheduledPublishAt;

  const metadata = { snippet, status };

  // Step 1: initiate resumable upload
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/*",
        "X-Upload-Content-Length": String(stats.size),
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!initRes.ok) {
    throw new Error(`YouTube init failed: ${initRes.status} ${await initRes.text()}`);
  }
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube init succeeded but returned no upload URL");

  // Step 2: PUT the bytes
  const stream = createReadStream(args.filePath);
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/*",
      "Content-Length": String(stats.size),
    },
    // @ts-expect-error - node ReadStream is accepted by undici
    body: stream,
    duplex: "half",
  });
  if (!uploadRes.ok) {
    throw new Error(`YouTube upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }
  const data = (await uploadRes.json()) as {
    id: string;
    status?: { privacyStatus?: string; uploadStatus?: string };
  };
  return {
    videoId: data.id,
    status: data.status?.uploadStatus ?? data.status?.privacyStatus ?? "uploaded",
  };
}
