import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { accountDir } from "./accounts-store";

export type CoachReport = {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  metrics: {
    total: number;
    posted: number;
    scheduled: number;
    failed: number;
    deleted: number;
    avgCaptionLength: number;
    avgHashtags: number;
    topChannels: Array<{ channel: string; count: number }>;
    timeBuckets: Array<{ bucket: string; count: number }>;
  };
  findings: string[];
  recommendations: string[];
  playbook: string[];
  insufficientData?: boolean;
};

function filePath(accountId: string): string {
  return join(accountDir(accountId), "ai-coach.json");
}

export async function readCoachReport(accountId: string): Promise<CoachReport | null> {
  try {
    const text = await readFile(filePath(accountId), "utf8");
    return JSON.parse(text) as CoachReport;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function writeCoachReport(
  accountId: string,
  report: CoachReport,
): Promise<CoachReport> {
  await mkdir(accountDir(accountId), { recursive: true });
  await writeFile(filePath(accountId), JSON.stringify(report, null, 2) + "\n");
  return report;
}
