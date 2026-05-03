import { mkdir, appendFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { accountDir } from "./accounts-store";

export type ScheduledRecord = {
  createdAt: string;
  scheduledAt: string;
  url: string;
  videoId: string;
  pageId: string;
  fbPostId: string;
  caption: string;
  status: "scheduled" | "posted" | "failed";
  publishedAt?: string;
  error?: string;
};

function scheduleFile(accountId: string): string {
  return join(accountDir(accountId), "schedule.jsonl");
}

export async function appendScheduleRecord(
  accountId: string,
  rec: ScheduledRecord,
): Promise<void> {
  const file = scheduleFile(accountId);
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(rec) + "\n", "utf8");
}

export async function listScheduleRecords(
  accountId: string,
): Promise<ScheduledRecord[]> {
  try {
    const text = await readFile(scheduleFile(accountId), "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ScheduledRecord);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function updateScheduleRecord(
  accountId: string,
  fbPostId: string,
  patch: Partial<ScheduledRecord>,
): Promise<ScheduledRecord | null> {
  const records = await listScheduleRecords(accountId);
  const idx = records.findIndex((r) => r.fbPostId === fbPostId);
  if (idx === -1) return null;
  records[idx] = { ...records[idx], ...patch };
  const text = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await writeFile(scheduleFile(accountId), text, "utf8");
  return records[idx];
}
