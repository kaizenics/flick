import { getAccount } from "@/lib/reposting/accounts-store";
import { upsertCandidates } from "@/lib/reposting/candidates-store";
import { readSharedConfig } from "@/lib/reposting/config-store";
import { discoverYoutubeCandidates } from "@/lib/reposting/youtube-discovery";

export const runtime = "nodejs";

type SearchBody = {
  query?: string;
  maxResults?: number;
  freshnessDays?: number;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id))) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as SearchBody;
  const query = body.query?.trim() ?? "";
  if (!query) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const maxResults = Number(body.maxResults ?? 10);
  const freshnessDays = Number(body.freshnessDays ?? 7);

  try {
    const shared = await readSharedConfig();
    const discovered = await discoverYoutubeCandidates({
      query,
      maxResults,
      freshnessDays,
      apiKey: shared.youtubeApiKey,
    });
    const result = await upsertCandidates(id, discovered);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "discover failed";
    const missingKey = msg.includes("YOUTUBE_API_KEY");
    return Response.json(
      { error: msg },
      { status: missingKey ? 422 : 500 },
    );
  }
}
