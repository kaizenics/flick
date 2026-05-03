import { mkdir, appendFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FILE = join(process.cwd(), "data", "reposting-schedule.jsonl");

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

export async function appendScheduleRecord(rec: ScheduledRecord): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await appendFile(FILE, JSON.stringify(rec) + "\n", "utf8");
}

export async function listScheduleRecords(): Promise<ScheduledRecord[]> {
  try {
    const text = await readFile(FILE, "utf8");
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
  fbPostId: string,
  patch: Partial<ScheduledRecord>,
): Promise<ScheduledRecord | null> {
  const records = await listScheduleRecords();
  const idx = records.findIndex((r) => r.fbPostId === fbPostId);
  if (idx === -1) return null;
  records[idx] = { ...records[idx], ...patch };
  const text = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await writeFile(FILE, text, "utf8");
  return records[idx];
}
