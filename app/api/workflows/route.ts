import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";

async function requireUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET() {
  await ensureSchema();
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const r = await db().execute({
    sql: "SELECT id, name, updatedAt FROM workflow WHERE userId = ? ORDER BY updatedAt DESC",
    args: [userId],
  });
  const items = r.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    updatedAt: Number(row.updatedAt),
  }));
  return Response.json({ items });
}

export async function POST(req: Request) {
  await ensureSchema();
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    data?: { nodes: unknown[]; edges: unknown[] };
  };
  const id = crypto.randomUUID();
  const now = Date.now();
  const name = body.name?.trim() || "Untitled workflow";
  const data = JSON.stringify(body.data ?? { nodes: [], edges: [] });
  await db().execute({
    sql: "INSERT INTO workflow (id, userId, name, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, userId, name, data, now, now],
  });
  return Response.json({ id, name, updatedAt: now });
}
