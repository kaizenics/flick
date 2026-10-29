import { mkdir, appendFile, readFile, rename, writeFile } from "node:fs/promises";
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
  status: "scheduled" | "posted" | "failed" | "deleted";
  publishedAt?: string;
  deletedAt?: string;
  error?: string;
};

function scheduleFile(accountId: string): string {
  return join(accountDir(accountId), "schedule.jsonl");
}

// Runs append while the status refresh rewrites the file; serialise per account
// so a rewrite never drops a line appended mid-way. shortcut: in-process lock,
// assumes one Node process (true for the single-user VPS/local setup).
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(accountId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(accountId, next.catch(() => {}));
  return next;
}

export async function appendScheduleRecord(
  accountId: string,
  rec: ScheduledRecord,
): Promise<void> {
  const file = scheduleFile(accountId);
  await withLock(accountId, async () => {
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify(rec) + "\n", "utf8");
  });
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
  return withLock(accountId, async () => {
    const records = await listScheduleRecords(accountId);
    const idx = records.findIndex((r) => r.fbPostId === fbPostId);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...patch };
    const text = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
    // Write then rename so a crash mid-write can't truncate the history.
    const file = scheduleFile(accountId);
    await writeFile(`${file}.tmp`, text, "utf8");
    await rename(`${file}.tmp`, file);
    return records[idx];
  });
}
