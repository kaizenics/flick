// Run: npx tsx lib/reposting/schedule-store.check.mts — concurrent append + rewrite must keep every record.
import assert from "node:assert";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = await mkdtemp(join(tmpdir(), "sched-"));
process.chdir(dir);
const s: typeof import("./schedule-store") = await import(new URL("./schedule-store.ts", import.meta.url).href);
const rec = (id: string) => ({ createdAt: "", scheduledAt: "", url: id, videoId: id, pageId: "p", fbPostId: id, caption: "", status: "scheduled" as const });
await s.appendScheduleRecord("acc", rec("a"));
await Promise.all([s.updateScheduleRecord("acc", "a", { status: "posted" }), s.appendScheduleRecord("acc", rec("b")), s.updateScheduleRecord("acc", "a", { caption: "x" })]);
const all = await s.listScheduleRecords("acc");
assert.deepEqual(all.map((r) => r.fbPostId), ["a", "b"]);
assert.equal(all[0].status, "posted");
console.log("schedule-store check ok", dir);
