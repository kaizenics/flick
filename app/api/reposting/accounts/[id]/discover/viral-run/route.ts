import { getAccount } from "@/lib/reposting/accounts-store";
import { readSharedConfig } from "@/lib/reposting/config-store";
import { runViralDiscovery } from "@/lib/reposting/viral-finder";
import { readViralProfile } from "@/lib/reposting/viral-profile-store";

export const runtime = "nodejs";

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

  const body = (await req.json().catch(() => ({}))) as {
    maxResults?: number;
    freshnessDays?: number;
  };

  try {
    const [profile, shared] = await Promise.all([
      readViralProfile(id),
      readSharedConfig(),
    ]);
    const result = await runViralDiscovery({
      accountId: id,
      profile,
      apiKey: shared.youtubeApiKey,
      ...body,
    });
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "viral run failed";
    const missingKey = msg.includes("YOUTUBE_API_KEY");
    return Response.json({ error: msg }, { status: missingKey ? 422 : 500 });
  }
}
