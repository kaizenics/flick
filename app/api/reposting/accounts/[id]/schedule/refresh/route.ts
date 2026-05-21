import { getAccount } from "@/lib/reposting/accounts-store";
import { readResolvedConfig } from "@/lib/reposting/config-store";
import {
  listScheduleRecords,
  updateScheduleRecord,
} from "@/lib/reposting/schedule-store";

export const runtime = "nodejs";

const DUE_GRACE_MS = 30_000;

type FbStatus = { exists: true; published: boolean } | { exists: false } | null;

async function fetchFbStatus(fbPostId: string, token: string): Promise<FbStatus> {
  const url = new URL(`https://graph.facebook.com/v21.0/${fbPostId}`);
  url.searchParams.set("fields", "published");
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { published?: boolean };
      return { exists: true, published: data.published === true };
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: { code?: number; error_subcode?: number; message?: string };
    };
    const err = data.error;
    if (err && (err.code === 100 || err.code === 803 || /does not exist|cannot be loaded/i.test(err.message ?? ""))) {
      return { exists: false };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await ctx.params;
  if (!(await getAccount(accountId)))
    return Response.json({ error: "not-found" }, { status: 404 });

  const cfg = await readResolvedConfig(accountId);
  const records = await listScheduleRecords(accountId);

  const now = Date.now();
  const scheduled = records.filter((r) => r.status === "scheduled");

  for (const r of scheduled) {
    const isDue = new Date(r.scheduledAt).getTime() <= now + DUE_GRACE_MS;

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

    const status = await fetchFbStatus(r.fbPostId, cfg.fbPageAccessToken);
    if (!status) continue;
    if (status.exists === false) {
      await updateScheduleRecord(accountId, r.fbPostId, {
        status: "deleted",
        deletedAt: new Date().toISOString(),
      });
      continue;
    }
    // FB's `published` flag on video objects is unreliable after auto-publish,
    // so once the scheduled time has passed and the post still exists, treat
    // it as posted. Explicit `published === true` accelerates the flip when
    // FB is honest about it.
    if (isDue && (status.published || new Date(r.scheduledAt).getTime() <= now)) {
      await updateScheduleRecord(accountId, r.fbPostId, {
        status: "posted",
        publishedAt: new Date().toISOString(),
      });
    }
  }

  const fresh = await listScheduleRecords(accountId);
  return Response.json({ records: fresh });
}
