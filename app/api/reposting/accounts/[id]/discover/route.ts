import { getAccount } from "@/lib/reposting/accounts-store";
import { clearCandidates, listCandidates } from "@/lib/reposting/candidates-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id))) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }
  const items = await listCandidates(id);
  return Response.json({ items });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id))) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }
  await clearCandidates(id);
  return Response.json({ ok: true });
}

