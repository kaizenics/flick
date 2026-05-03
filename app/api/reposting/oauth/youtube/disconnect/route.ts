import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/reposting/accounts-store";
import { disconnect } from "@/lib/reposting/youtube-oauth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { accountId?: string };
  if (!body.accountId)
    return Response.json({ error: "accountId required" }, { status: 400 });
  if (!(await getAccount(body.accountId)))
    return Response.json({ error: "not-found" }, { status: 404 });
  await disconnect(body.accountId);
  return Response.json({ ok: true });
}
