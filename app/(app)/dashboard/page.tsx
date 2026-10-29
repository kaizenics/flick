import Link from "next/link";
import {
  ArrowUpRight,
  ExternalLink,
  LayoutDashboard,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { EngagementRunState } from "@/components/dashboard/Dashboard";
import { listScheduleRecords } from "@/lib/reposting/schedule-store";
import { listAccounts, type Flow } from "@/lib/reposting/accounts-store";
import { listAccounts as listEngagementAccounts } from "@/lib/accounts";
import { hasStorageState } from "@/lib/automation/browser";
import {
  YoutubeIcon,
  InstagramIcon,
  FacebookIcon,
  TiktokIcon,
} from "@/components/icons/brand";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    const futureMin = Math.floor(-diff / 60_000);
    if (futureMin < 60) return `in ${futureMin}m`;
    const futureH = Math.floor(futureMin / 60);
    if (futureH < 24) return `in ${futureH}h`;
    const futureD = Math.floor(futureH / 24);
    return `in ${futureD}d`;
  }
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

type EnrichedRecord = Awaited<ReturnType<typeof listScheduleRecords>>[number] & {
  flow: Flow;
  accountId: string;
  accountName: string;
};

const FLOW_LABELS: Record<Flow, string> = {
  "yt-to-fb": "YouTube → Facebook",
  "ig-to-yt": "Instagram → YouTube",
  "tt-to-fb": "TikTok → Facebook",
};

function FlowBadge({ flow }: { flow: Flow }) {
  const [From, fromColor, To, toColor] =
    flow === "yt-to-fb"
      ? [YoutubeIcon, "text-[#ff0000]", FacebookIcon, "text-[#1877f2]"]
      : flow === "tt-to-fb"
        ? [TiktokIcon, "", FacebookIcon, "text-[#1877f2]"]
        : [InstagramIcon, "text-[#e4405f]", YoutubeIcon, "text-[#ff0000]"];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground" title={FLOW_LABELS[flow]}>
      <From size={14} className={fromColor} />
      <span className="text-xs">→</span>
      <To size={14} className={toColor} />
    </span>
  );
}

function destinationUrl(r: EnrichedRecord): string {
  if (r.flow === "ig-to-yt") return `https://youtu.be/${r.fbPostId}`;
  return `https://www.facebook.com/${r.fbPostId}`;
}

function StatusBadge({ status }: { status: EnrichedRecord["status"] }) {
  if (status === "posted") return <Badge variant="positive">Posted</Badge>;
  if (status === "failed") return <Badge variant="negative">Failed</Badge>;
  if (status === "deleted") return <Badge variant="negative">Deleted</Badge>;
  return <Badge variant="neutral">Scheduled</Badge>;
}

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const TOOLS = [
  { title: "Automation flow", href: "/flow", note: "Build automation workflows" },
  { title: "Video editor", href: "/video-editor", note: "Edit and export videos" },
  { title: "Scraping", href: "/scraping", note: "Collect content from the web" },
  { title: "Archives", href: "/archives", note: "Every scheduled and posted record" },
];

export default async function DashboardPage() {
  const accounts = await listAccounts();
  const allRecords = await Promise.all(
    accounts.map(async (a) => {
      const list = await listScheduleRecords(a.id);
      return list.map(
        (r): EnrichedRecord => ({
          ...r,
          flow: a.flow,
          accountId: a.id,
          accountName: a.name,
        }),
      );
    }),
  );
  const records = allRecords.flat();

  const engagementAccounts = await Promise.all(
    (await listEngagementAccounts()).map(async (a) => ({
      ...a,
      hasSession: await hasStorageState(a.id),
    })),
  );
  const missingSessions = engagementAccounts.filter((a) => !a.hasSession).length;

  const todayStr = new Date().toDateString();
  const scheduledRecords = records.filter((r) => r.status === "scheduled");
  const postedRecords = records.filter((r) => r.status === "posted");
  const failedRecords = records.filter((r) => r.status === "failed");
  const postedTodayCount = postedRecords.filter((r) => {
    const when = r.publishedAt ?? r.createdAt;
    return new Date(when).toDateString() === todayStr;
  }).length;

  const now = Date.now();
  const upcoming = [...scheduledRecords]
    .filter((r) => new Date(r.scheduledAt).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 5);
  const nextScheduled = upcoming[0];

  const recent = [...records]
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);

  const kpis = [
    {
      label: "Scheduled",
      value: scheduledRecords.length,
      hint: nextScheduled ? `Next ${relativeTime(nextScheduled.scheduledAt)}` : "Nothing pending",
    },
    {
      label: "Posted today",
      value: postedTodayCount,
      hint: `${postedRecords.length} posted all-time`,
    },
    {
      label: "Failed",
      value: failedRecords.length,
      hint: failedRecords.length ? "Check reposting history" : "No failures",
      alert: failedRecords.length > 0,
    },
    {
      label: "FB sessions",
      value: engagementAccounts.length - missingSessions,
      hint: `of ${engagementAccounts.length} account${engagementAccounts.length === 1 ? "" : "s"}`,
      alert: missingSessions > 0,
    },
  ];

  // One-sentence finding: what needs the user, else what's next.
  const issues = [
    failedRecords.length > 0 &&
      `${failedRecords.length} post${failedRecords.length === 1 ? "" : "s"} failed`,
    missingSessions > 0 &&
      `${missingSessions} engagement account${missingSessions === 1 ? " needs" : "s need"} a Facebook login`,
    accounts.length === 0 && "no reposting account set up yet",
  ].filter(Boolean) as string[];
  const finding = issues.length
    ? `${issues.join(", ").replace(/^./, (c) => c.toUpperCase())}.`
    : nextScheduled
      ? `All clear. Next post goes out ${relativeTime(nextScheduled.scheduledAt)} on ${nextScheduled.accountName}.`
      : "All clear. Nothing is queued right now.";

  return (
    <>
      <AppTopbar title="Overview" icon={LayoutDashboard} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-7 pb-16 md:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-xl font-semibold">Overview</h1>
            <p className={cn("text-sm", issues.length ? "text-warning" : "text-muted-foreground")}>
              {finding}
            </p>
          </div>
          <Button render={<Link href="/reposting" />} nativeButton={false}>
            <Plus data-icon="inline-start" /> Queue posts
          </Button>
        </div>

        {/* KPI strip: one panel, divided cells. */}
        <div className="grid grid-cols-2 overflow-hidden rounded-[20px] bg-card lg:grid-cols-4">
          {kpis.map((k, i) => (
            <div
              key={k.label}
              className={cn(
                "flex min-w-0 flex-col gap-1 p-5",
                i % 2 === 0 && "border-r border-border",
                i < 2 && "border-b border-border lg:border-b-0",
                i === 1 && "lg:border-r",
              )}
            >
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <span className={cn("num text-2xl font-semibold", k.alert && "text-warning")}>
                {k.value}
              </span>
              <span className="truncate text-xs text-faint">{k.hint}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-3.5 lg:grid-cols-2">
          {/* Engagement accounts */}
          <section className="flex min-w-0 flex-col rounded-[20px] bg-card">
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h2 className="text-base font-medium">
                Page engagement{" "}
                <span className="num font-normal text-muted-foreground">{engagementAccounts.length}</span>
              </h2>
              <Button size="sm" variant="ghost" render={<Link href="/engagement" />} nativeButton={false}>
                Open <ArrowUpRight data-icon="inline-end" />
              </Button>
            </div>
            {engagementAccounts.length === 0 ? (
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                No Facebook accounts yet.
              </p>
            ) : (
              <ul>
                {engagementAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
                    <span className="min-w-0 truncate text-sm">{a.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {a.hasSession ? (
                        <EngagementRunState accountId={a.id} />
                      ) : (
                        <Badge variant="warning">Needs login</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Reposting accounts */}
          <section className="flex min-w-0 flex-col rounded-[20px] bg-card">
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h2 className="text-base font-medium">
                Reposting{" "}
                <span className="num font-normal text-muted-foreground">{accounts.length}</span>
              </h2>
              <Button size="sm" variant="ghost" render={<Link href="/reposting" />} nativeButton={false}>
                Open <ArrowUpRight data-icon="inline-end" />
              </Button>
            </div>
            {accounts.length === 0 ? (
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                No reposting accounts yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-faint">
                      <th className="px-5 py-2 font-normal">Account</th>
                      <th className="px-2 py-2 text-right font-normal sm:px-3">Queued</th>
                      <th className="px-2 py-2 text-right font-normal sm:px-3">Posted</th>
                      <th className="py-2 pr-5 pl-2 text-right font-normal sm:pl-3">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => {
                      const mine = records.filter((r) => r.accountId === a.id);
                      const count = (s: EnrichedRecord["status"]) =>
                        mine.filter((r) => r.status === s).length;
                      const failed = count("failed");
                      return (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-5 py-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <FlowBadge flow={a.flow} />
                              <span className="truncate">{a.name}</span>
                            </span>
                          </td>
                          <td className="num px-2 py-3 text-right sm:px-3">{count("scheduled")}</td>
                          <td className="num px-2 py-3 text-right sm:px-3">{count("posted")}</td>
                          <td className={cn("num py-3 pr-5 pl-2 text-right sm:pl-3", failed > 0 && "text-danger-ink")}>
                            {failed}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          {/* Upcoming */}
          <section className="flex min-w-0 flex-col rounded-[20px] bg-card">
            <h2 className="px-5 pt-5 pb-3 text-base font-medium">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                Nothing scheduled.
              </p>
            ) : (
              <ul>
                {upcoming.map((r) => (
                  <li
                    key={r.fbPostId + r.scheduledAt}
                    className="flex items-start justify-between gap-3 border-t border-border px-5 py-3.5"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <FlowBadge flow={r.flow} />
                        <span className="truncate text-muted-foreground">{r.accountName}</span>
                      </span>
                      <span className="line-clamp-1 text-sm">{r.caption || r.url}</span>
                    </div>
                    <span
                      className="num shrink-0 text-xs text-muted-foreground"
                      title={new Date(r.scheduledAt).toLocaleString()}
                    >
                      {relativeTime(r.scheduledAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent activity */}
          <section className="flex min-w-0 flex-col rounded-[20px] bg-card">
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h2 className="text-base font-medium">Recent activity</h2>
              <span className="num text-xs text-faint">{records.length} records all-time</span>
            </div>
            {recent.length === 0 ? (
              <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                No reposting activity yet.
              </p>
            ) : (
              <ul>
                {recent.map((r) => {
                  const isPosted = r.status === "posted";
                  const isDeleted = r.status === "deleted";
                  const ts = isPosted && r.publishedAt ? r.publishedAt : r.scheduledAt;
                  return (
                    <li
                      key={r.fbPostId + r.createdAt}
                      className="flex items-start justify-between gap-3 border-t border-border px-5 py-3.5"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <StatusBadge status={r.status} />
                          <FlowBadge flow={r.flow} />
                          <span className="truncate text-muted-foreground">{r.accountName}</span>
                        </span>
                        <span
                          className={cn(
                            "line-clamp-1 text-sm",
                            isDeleted && "text-muted-foreground line-through",
                          )}
                        >
                          {r.caption || r.url}
                        </span>
                        {r.status === "failed" && r.error && (
                          <span className="line-clamp-1 text-xs text-danger-ink">{r.error}</span>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="num text-xs text-muted-foreground" title={fmtShort(ts)}>
                          {relativeTime(ts)}
                        </span>
                        {isPosted && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            render={<a href={destinationUrl(r)} target="_blank" rel="noopener noreferrer" />}
                            nativeButton={false}
                            aria-label={r.flow === "ig-to-yt" ? "Open on YouTube" : "Open on Facebook"}
                          >
                            <ExternalLink />
                          </Button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Other tools */}
        <section className="grid grid-cols-1 overflow-hidden rounded-[20px] bg-card sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group flex min-w-0 items-start justify-between gap-3 border-b border-border p-5 transition-colors last:border-b-0 hover:bg-raised focus-visible:bg-raised focus-visible:outline-none sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-xs text-faint">{t.note}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
