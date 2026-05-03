import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  listAccounts,
  addAccount,
  renameAccount,
  deleteAccount,
  FLOWS,
  type Flow,
} from "@/lib/reposting/accounts-store";

export const runtime = "nodejs";

async function requireUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET() {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const accounts = await listAccounts();
  return Response.json({ accounts });
}

export async function POST(req: Request) {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    flow?: Flow;
  };
  const flow: Flow = body.flow && FLOWS.includes(body.flow) ? body.flow : "yt-to-fb";
  const account = await addAccount(body.name ?? "", flow);
  return Response.json(account);
}

export async function PATCH(req: Request) {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; name?: string };
  if (!body.id || !body.name)
    return Response.json({ error: "id and name required" }, { status: 400 });
  const account = await renameAccount(body.id, body.name);
  if (!account) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json(account);
}

export async function DELETE(req: Request) {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const ok = await deleteAccount(id);
  if (!ok) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json({ ok: true });
}
