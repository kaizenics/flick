import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";

async function requireUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const r = await db().execute({
    sql: "SELECT id, name, data, updatedAt FROM workflow WHERE id = ? AND userId = ?",
    args: [id, userId],
  });
  const row = r.rows[0];
  if (!row) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json({
    id: String(row.id),
    name: String(row.name),
    data: JSON.parse(String(row.data)),
    updatedAt: Number(row.updatedAt),
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    data?: { nodes: unknown[]; edges: unknown[] };
  };
  const now = Date.now();
  const sets: string[] = ["updatedAt = ?"];
  const args: (string | number)[] = [now];
  if (typeof body.name === "string") {
    sets.push("name = ?");
    args.push(body.name);
  }
  if (body.data) {
    sets.push("data = ?");
    args.push(JSON.stringify(body.data));
  }
  args.push(id, userId);
  const r = await db().execute({
    sql: `UPDATE workflow SET ${sets.join(", ")} WHERE id = ? AND userId = ?`,
    args,
  });
  if (r.rowsAffected === 0)
    return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json({ ok: true, updatedAt: now });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await db().execute({
    sql: "DELETE FROM workflow WHERE id = ? AND userId = ?",
    args: [id, userId],
  });
  return Response.json({ ok: true });
}
