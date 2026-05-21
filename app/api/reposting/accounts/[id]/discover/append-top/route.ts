import { getAccount } from "@/lib/reposting/accounts-store";
import { readViralProfile } from "@/lib/reposting/viral-profile-store";
import { selectTopCandidatesForAppend } from "@/lib/reposting/viral-finder";

export const runtime = "nodejs";

type Body = {
  existingTodayCount?: number;
  queueUrls?: string[];
  limit?: number;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const account = await getAccount(id);
  if (!account) return Response.json({ error: "not-found" }, { status: 404 });
  if (account.flow !== "yt-to-fb") {
    return Response.json({ error: "unsupported-flow" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const profile = await readViralProfile(id);

  try {
    const result = await selectTopCandidatesForAppend({
      accountId: id,
      minViralScore: profile.minViralScore,
      existingTodayCount: Number(body.existingTodayCount ?? 0),
      queueUrls: Array.isArray(body.queueUrls) ? body.queueUrls : [],
      limit: Number(body.limit ?? 0) || undefined,
    });
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "append-top failed";
    if (msg === "not-found") {
      return Response.json({ error: "not-found" }, { status: 404 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
