import { getAccount } from "@/lib/reposting/accounts-store";
import { channelShortsUrl, listChannelShorts } from "@/lib/reposting/channel-shorts";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id)))
    return Response.json({ error: "not-found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { channel?: string; limit?: number | null };
  const shortsUrl = channelShortsUrl(body.channel ?? "");
  if (!shortsUrl)
    return Response.json({ error: "Not a YouTube channel link" }, { status: 400 });
  const limit =
    body.limit == null ? null : Math.min(Math.max(1, Math.floor(Number(body.limit)) || 20), 1000);

  try {
    const shorts = await listChannelShorts(shortsUrl, limit);
    return Response.json({ channel: shortsUrl, shorts });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not list Shorts" },
      { status: 502 },
    );
  }
}
