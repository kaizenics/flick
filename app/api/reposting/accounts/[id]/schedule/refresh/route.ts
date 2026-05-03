import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/reposting/accounts-store";
import { readResolvedConfig } from "@/lib/reposting/config-store";
import {
  listScheduleRecords,
  updateScheduleRecord,
} from "@/lib/reposting/schedule-store";

export const runtime = "nodejs";

const DUE_GRACE_MS = 30_000;

async function fetchPublishedFlag(
  fbPostId: string,
  token: string,
): Promise<boolean | null> {
  const url = new URL(`https://graph.facebook.com/v21.0/${fbPostId}`);
  url.searchParams.set("fields", "published");
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { published?: boolean };
    return data.published === true;
  } catch {
    return null;
  }
}

async function requireUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: accountId } = await ctx.params;
  if (!(await getAccount(accountId)))
    return Response.json({ error: "not-found" }, { status: 404 });

  const cfg = await readResolvedConfig(accountId);
  const records = await listScheduleRecords(accountId);

  const now = Date.now();
  const due = records.filter(
    (r) =>
      r.status === "scheduled" &&
      new Date(r.scheduledAt).getTime() <= now + DUE_GRACE_MS,
  );

  for (const r of due) {
    if (r.pageId === "youtube") {
      if (new Date(r.scheduledAt).getTime() <= now) {
        await updateScheduleRecord(accountId, r.fbPostId, {
          status: "posted",
          publishedAt: new Date().toISOString(),
        });
      }
      continue;
    }
    if (!cfg.fbPageAccessToken) continue;
    const published = await fetchPublishedFlag(r.fbPostId, cfg.fbPageAccessToken);
    if (published === true) {
      await updateScheduleRecord(accountId, r.fbPostId, {
        status: "posted",
        publishedAt: new Date().toISOString(),
      });
    }
  }

  const fresh = await listScheduleRecords(accountId);
  return Response.json({ records: fresh });
}
