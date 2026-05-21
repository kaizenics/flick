import {
  deleteWorkflowById,
  getWorkflowById,
  updateWorkflowById,
} from "@/lib/workflows-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const row = await getWorkflowById(id);
  if (!row) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json(row);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    data?: { nodes: unknown[]; edges: unknown[] };
  };

  const result = await updateWorkflowById(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    data: body.data,
  });

  if (!result) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }

  return Response.json({ ok: true, updatedAt: result.updatedAt });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await deleteWorkflowById(id);
  return Response.json({ ok: true });
}
