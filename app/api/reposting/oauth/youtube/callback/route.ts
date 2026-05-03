import { getAccount } from "@/lib/reposting/accounts-store";
import { saveStateFromCode } from "@/lib/reposting/youtube-oauth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const accountId = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    return new Response(`OAuth declined: ${error}`, { status: 400 });
  }
  if (!code || !accountId) {
    return new Response("Missing code or state", { status: 400 });
  }
  if (!(await getAccount(accountId))) {
    return new Response("Unknown account", { status: 404 });
  }
  try {
    await saveStateFromCode(accountId, code);
    return Response.redirect(
      new URL(`/reposting?yt-connected=${encodeURIComponent(accountId)}`, url.origin),
      302,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth error";
    return new Response(msg, { status: 500 });
  }
}
