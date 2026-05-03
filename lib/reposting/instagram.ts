import { spawn } from "node:child_process";

export type ReelMeta = {
  id: string;
  title: string;
  description: string;
  uploader?: string;
};

export function extractReelId(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:[\w.-]+\/)?(?:reel|reels|p|tv)\/([\w-]+)/i);
  return m ? m[1] : null;
}

function ytDlpJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "yt-dlp",
      ["--skip-download", "--no-warnings", "--dump-single-json", url],
      { stdio: "pipe" },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => (stdout += c.toString()));
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp meta failed (${code}): ${stderr.slice(0, 400)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>);
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function getReelMeta(url: string): Promise<ReelMeta> {
  const id = extractReelId(url);
  if (!id) throw new Error(`Not a recognizable Instagram Reel URL: ${url}`);
  const data = await ytDlpJson(url);
  const title = (data.title as string) || (data.fulltitle as string) || `Instagram Reel ${id}`;
  const description = (data.description as string) || "";
  const uploader = (data.uploader as string) || (data.uploader_id as string) || undefined;
  return { id, title, description, uploader };
}
