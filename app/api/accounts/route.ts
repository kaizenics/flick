import {
  listAccounts,
  addAccount,
  deleteAccount,
  renameAccount,
  setProxy,
  type ProxyConfig,
} from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listAccounts());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const account = await addAccount(body.name ?? "");
  return Response.json(account);
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    proxy?: ProxyConfig | null;
  };
  if (!body.id) {
    return Response.json({ ok: false, reason: "missing-id" }, { status: 400 });
  }
  if (typeof body.name === "string" && body.name) {
    await renameAccount(body.id, body.name);
  }
  if (body.proxy !== undefined) {
    await setProxy(body.id, body.proxy ?? undefined);
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ ok: false, reason: "missing-id" }, { status: 400 });
  try {
    await deleteAccount(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : "error" },
      { status: 400 },
    );
  }
}
