import { getAccount } from "@/lib/reposting/accounts-store";
import { buildAuthorizeUrl } from "@/lib/reposting/youtube-oauth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  if (!accountId)
    return Response.json({ error: "accountId required" }, { status: 400 });
  if (!(await getAccount(accountId)))
    return Response.json({ error: "not-found" }, { status: 404 });
  try {
    const authorize = buildAuthorizeUrl(accountId);
    return Response.redirect(authorize, 302);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config error";
    return new Response(msg, { status: 500 });
  }
}
