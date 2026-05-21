import { getAccount } from "@/lib/reposting/accounts-store";
import { listPreflightItems } from "@/lib/reposting/ai-preflight-store";
import { runAiPreflight } from "@/lib/reposting/ai-copilot";

export const runtime = "nodejs";

type Body = {
  items?: Array<{
    url?: string;
    caption?: string;
    comment?: string;
  }>;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const account = await getAccount(id);
  if (!account) return Response.json({ error: "not-found" }, { status: 404 });
  if (account.flow !== "yt-to-fb") {
    return Response.json({ error: "unsupported-flow" }, { status: 400 });
  }
  const items = await listPreflightItems(id);
  return Response.json({ items });
}

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
  const items = (body.items ?? [])
    .map((item) => ({
      url: item.url?.trim() ?? "",
      caption: item.caption?.trim(),
      comment: item.comment?.trim(),
    }))
    .filter((item) => item.url.length > 0);
  if (items.length === 0) {
    return Response.json({ error: "no-items" }, { status: 400 });
  }

  try {
    const result = await runAiPreflight(id, items);
    return Response.json({ items: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "preflight failed";
    const missingConfig = message.includes("not configured");
    return Response.json({ error: message }, { status: missingConfig ? 422 : 500 });
  }
}
