import { getAccount } from "@/lib/reposting/accounts-store";
import {
  readAccountConfigMasked,
  writeAccountConfig,
} from "@/lib/reposting/config-store";
import { readState } from "@/lib/reposting/youtube-oauth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id)))
    return Response.json({ error: "not-found" }, { status: 404 });
  const account = await getAccount(id);
  const masked = await readAccountConfigMasked(id);
  const youtubeOauth = await readState(id);
  return Response.json({
    ...masked,
    flow: account?.flow,
    youtube: youtubeOauth
      ? {
          connected: true,
          channelId: youtubeOauth.channelId ?? null,
          channelTitle: youtubeOauth.channelTitle ?? null,
          connectedAt: youtubeOauth.connectedAt,
        }
      : { connected: false },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id)))
    return Response.json({ error: "not-found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    fbPageAccessToken?: string;
    defaultPageId?: string;
  };
  await writeAccountConfig(id, {
    fbPageAccessToken: body.fbPageAccessToken,
    defaultPageId: body.defaultPageId,
  });
  const account = await getAccount(id);
  const masked = await readAccountConfigMasked(id);
  const youtubeOauth = await readState(id);
  return Response.json({
    ...masked,
    flow: account?.flow,
    youtube: youtubeOauth
      ? {
          connected: true,
          channelId: youtubeOauth.channelId ?? null,
          channelTitle: youtubeOauth.channelTitle ?? null,
          connectedAt: youtubeOauth.connectedAt,
        }
      : { connected: false },
  });
}
