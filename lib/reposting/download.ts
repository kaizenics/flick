import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

function formatArgsForUrl(url: string): string[] {
  // TikTok and Instagram serve pre-muxed single-file mp4s; YouTube needs
  // an explicit video+audio format pair. Per-host selectors avoid the
  // "Requested format is not available" failure mode.
  if (/tiktok\.com/i.test(url)) {
    return ["-f", "mp4/best[ext=mp4]/best"];
  }
  if (/instagram\.com/i.test(url)) {
    return ["-f", "mp4/best[ext=mp4]/best"];
  }
  return [
    "-f",
    "(bv*[height=1080][vcodec^=avc1]/bv*[width=1080][vcodec^=avc1])+(ba[ext=m4a]/ba)",
    "--merge-output-format",
    "mp4",
  ];
}

export async function downloadVideo(urlOrId: string): Promise<string> {
  const url = /^https?:\/\//.test(urlOrId)
    ? urlOrId
    : `https://www.youtube.com/shorts/${urlOrId}`;
  const out = join(tmpdir(), `yt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "yt-dlp",
      [...formatArgsForUrl(url), "-o", out, url],
      { stdio: "pipe" },
    );
    let stderr = "";
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited ${code}: ${stderr}`));
    });
  });
  return out;
}

export const downloadShort = downloadVideo;
