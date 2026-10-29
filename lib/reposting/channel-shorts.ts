import { spawn } from "node:child_process";

export type ChannelShort = { id: string; url: string; title: string };

/**
 * Turns a pasted channel reference into its Shorts tab URL, or null if it isn't
 * a YouTube channel. Accepts youtube.com/@handle, /channel/UC…, /c/name, /user/name
 * (any tab) and a bare @handle. The result is rebuilt from validated parts, so
 * nothing the user typed reaches yt-dlp verbatim.
 */
export function channelShortsUrl(input: string): string | null {
  const raw = input.trim();
  const bare = raw.match(/^@([A-Za-z0-9._-]{1,100})$/);
  if (bare) return `https://www.youtube.com/@${bare[1]}/shorts`;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/^(www\.|m\.)?youtube\.com$/i.test(u.hostname)) return null;
  const [first, second] = u.pathname.split("/").filter(Boolean);
  if (!first) return null;
  const handle = first.match(/^@([A-Za-z0-9._-]{1,100})$/);
  if (handle) return `https://www.youtube.com/@${handle[1]}/shorts`;
  if (first === "channel" && second && /^UC[A-Za-z0-9_-]{22}$/.test(second))
    return `https://www.youtube.com/channel/${second}/shorts`;
  if ((first === "c" || first === "user") && second && /^[A-Za-z0-9._-]{1,100}$/.test(second))
    return `https://www.youtube.com/${first}/${second}/shorts`;
  return null;
}

/** Newest-first list of a channel's Shorts. `limit` null means all. */
export async function listChannelShorts(
  shortsUrl: string,
  limit: number | null,
): Promise<ChannelShort[]> {
  const args = ["--flat-playlist", "--no-warnings", "--print", "%(id)s\t%(title)s"];
  if (limit) args.push("--playlist-end", String(limit));
  args.push(shortsUrl);
  const out = await new Promise<string>((resolve, reject) => {
    const proc = spawn("yt-dlp", args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => proc.kill("SIGKILL"), 120_000);
    proc.stdout.on("data", (c) => (stdout += c.toString()));
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim().split("\n").pop() || `yt-dlp exited ${code}`));
    });
  });
  return out
    .split("\n")
    .map((line) => {
      const [id, ...rest] = line.split("\t");
      return { id: id.trim(), title: rest.join("\t").trim() };
    })
    .filter((s) => /^[A-Za-z0-9_-]{11}$/.test(s.id))
    .map((s) => ({ ...s, url: `https://www.youtube.com/shorts/${s.id}` }));
}
