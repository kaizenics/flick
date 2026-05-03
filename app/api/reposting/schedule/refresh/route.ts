import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { readConfig } from "@/lib/reposting/config-store";
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

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = await readConfig();
  const records = await listScheduleRecords();

  if (!cfg.fbPageAccessToken) {
    return Response.json({ records });
  }

  const now = Date.now();
  const due = records.filter(
    (r) =>
      r.status === "scheduled" &&
      new Date(r.scheduledAt).getTime() <= now + DUE_GRACE_MS,
  );

  for (const r of due) {
    const published = await fetchPublishedFlag(r.fbPostId, cfg.fbPageAccessToken);
    if (published === true) {
      await updateScheduleRecord(r.fbPostId, {
        status: "posted",
        publishedAt: new Date().toISOString(),
      });
    }
  }

  const fresh = await listScheduleRecords();
  return Response.json({ records: fresh });
}
