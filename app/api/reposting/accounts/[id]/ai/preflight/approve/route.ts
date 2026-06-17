import { getAccount } from "@/lib/reposting/accounts-store";
import { approveAiPreflightItem } from "@/lib/reposting/ai-copilot";

export const runtime = "nodejs";

type Body = {
  url?: string;
  variantId?: string;
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
  const url = body.url?.trim() ?? "";
  const variantId = body.variantId?.trim() ?? "";
  if (!url || !variantId) {
    return Response.json({ error: "url and variantId required" }, { status: 400 });
  }

  try {
    const item = await approveAiPreflightItem({
      accountId: id,
      url,
      variantId,
    });
    return Response.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "approve failed";
    if (message === "preflight-not-found") {
      return Response.json({ error: message }, { status: 404 });
    }
    if (message === "variant-not-found") {
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
