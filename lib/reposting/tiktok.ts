import { spawn } from "node:child_process";

export type TiktokMeta = {
  id: string;
  title: string;
  description: string;
  uploader?: string;
};

export function extractTiktokId(url: string): string | null {
  const m1 = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i);
  if (m1) return m1[1];
  const m2 = url.match(/(?:vm|vt)\.tiktok\.com\/([\w-]+)/i);
  if (m2) return m2[1];
  const m3 = url.match(/tiktok\.com\/t\/([\w-]+)/i);
  if (m3) return m3[1];
  return null;
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

export async function getTiktokMeta(url: string): Promise<TiktokMeta> {
  const id = extractTiktokId(url);
  if (!id) throw new Error(`Not a recognizable TikTok URL: ${url}`);
  const data = await ytDlpJson(url);
  const title = (data.title as string) || (data.fulltitle as string) || `TikTok ${id}`;
  const description = (data.description as string) || (data.title as string) || "";
  const uploader = (data.uploader as string) || (data.uploader_id as string) || undefined;
  return { id, title, description, uploader };
}
