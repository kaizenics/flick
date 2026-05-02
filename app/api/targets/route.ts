import { readConfig, writeConfig, type Config, type ReactionKind, type ReactionTarget } from "@/lib/store";

const VALID_REACTIONS: ReactionKind[] = ["like", "love", "haha", "wow", "sad", "angry"];
import { DEFAULT_ACCOUNT_ID } from "@/lib/accounts";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  return Response.json(await readConfig(accountId));
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  const body = (await req.json()) as Partial<Config>;
  const current = await readConfig(accountId);
  const targetUrls = Array.isArray(body.targetUrls)
    ? body.targetUrls.map((u) => String(u).trim()).filter((u) => u.length > 0)
    : typeof body.targetUrl === "string"
      ? [body.targetUrl.trim()].filter((u) => u.length > 0)
      : current.targetUrls;
  const next: Config = {
    targetUrl: targetUrls[0] ?? "",
    targetUrls,
    sources: Array.isArray(body.sources)
      ? body.sources.map((s) => ({
          id: s.id ?? crypto.randomUUID(),
          name: String(s.name ?? "").trim(),
          note: s.note?.toString(),
        }))
      : current.sources,
    posts: Array.isArray(body.posts)
      ? body.posts
          .map((p): ReactionTarget | null => {
            const url = String(p?.url ?? "").trim();
            const reaction = VALID_REACTIONS.includes(p?.reaction as ReactionKind)
              ? (p.reaction as ReactionKind)
              : "like";
            return url ? { url, reaction } : null;
          })
          .filter((p): p is ReactionTarget => p !== null)
      : current.posts,
  };
  await writeConfig(next, accountId);
  return Response.json(next);
}
