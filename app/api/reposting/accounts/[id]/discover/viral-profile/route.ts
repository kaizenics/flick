import { getAccount } from "@/lib/reposting/accounts-store";
import {
  readViralProfile,
  writeViralProfile,
  type ViralProfile,
} from "@/lib/reposting/viral-profile-store";

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
  return Response.json(await readViralProfile(id));
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

  const body = (await req.json().catch(() => ({}))) as Partial<ViralProfile>;
  const next = await writeViralProfile(id, body);
  return Response.json(next);
}
