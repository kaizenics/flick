import { getAccount } from "@/lib/reposting/accounts-store";
import { generateAiCoachReport, getAiCoachReport } from "@/lib/reposting/ai-copilot";

export const runtime = "nodejs";

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
  const report = await getAiCoachReport(id);
  return Response.json({ report });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const account = await getAccount(id);
  if (!account) return Response.json({ error: "not-found" }, { status: 404 });
  if (account.flow !== "yt-to-fb") {
    return Response.json({ error: "unsupported-flow" }, { status: 400 });
  }
  try {
    const report = await generateAiCoachReport(id);
    return Response.json({ report });
  } catch (e) {
    const message = e instanceof Error ? e.message : "coach generation failed";
    const missingConfig = message.includes("not configured");
    return Response.json({ error: message }, { status: missingConfig ? 422 : 500 });
  }
}
