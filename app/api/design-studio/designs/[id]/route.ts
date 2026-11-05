import { deleteDesign, getDesign, updateDesign } from "@/lib/design-studio/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const design = await getDesign(id);
  if (!design) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json({ design });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return Response.json({ error: "invalid-body" }, { status: 400 });
  const design = await updateDesign(id, {
    name: body.name,
    width: body.width,
    height: body.height,
    doc: body.doc,
  });
  if (!design) return Response.json({ error: "not-found" }, { status: 404 });
  const { doc: _doc, ...summary } = design;
  return Response.json({ design: summary });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await deleteDesign(id);
  if (!ok) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json({ ok: true });
}
