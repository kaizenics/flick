import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Workflow,
  FileStack,
  Smile,
  Repeat2,
  Activity,
  Clock,
  CircleCheck,
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { listScheduleRecords } from "@/lib/reposting/schedule-store";
import { listAccounts, type Flow } from "@/lib/reposting/accounts-store";
import {
  YoutubeIcon,
  InstagramIcon,
  FacebookIcon,
} from "@/components/icons/brand";

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

const tools = [
  {
    href: "/reposting",
    title: "Reposting",
    description:
      "Cross-platform reposter: YouTube → Facebook and Instagram → YouTube, with AI captions + native scheduling.",
    icon: Repeat2,
    available: true,
  },
  {
    href: "/engagement",
    title: "Page Engagement",
    description:
      "Follow, like, and engage with a target Page across multiple accounts.",
    icon: Heart,
    available: true,
  },
  {
    href: "/flow",
    title: "Automation Flow",
    description:
      "Node-based view of the engagement pipeline with live execution highlighting.",
    icon: Workflow,
    available: true,
  },
  {
    href: "/page-creation",
    title: "Page Creation",
    description: "Spin up new Facebook Pages in bulk from a logged-in account.",
    icon: FileStack,
    available: false,
  },
  {
    href: "/reactions",
    title: "Reactions",
    description: "Drop reactions on a target post from each of your owned Pages.",
    icon: Smile,
    available: false,
  },
];

type EnrichedRecord = Awaited<ReturnType<typeof listScheduleRecords>>[number] & {
  flow: Flow;
  accountId: string;
  accountName: string;
};

function FlowBadge({ flow }: { flow: Flow }) {
  if (flow === "yt-to-fb") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <YoutubeIcon size={12} className="text-[#ff0000]" />
        <span className="text-[10px]">→</span>
        <FacebookIcon size={12} className="text-[#1877f2]" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <InstagramIcon size={12} className="text-[#e4405f]" />
      <span className="text-[10px]">→</span>
      <YoutubeIcon size={12} className="text-[#ff0000]" />
    </span>
  );
}

function destinationUrl(r: EnrichedRecord): string {
  if (r.flow === "ig-to-yt") return `https://youtu.be/${r.fbPostId}`;
  return `https://www.facebook.com/${r.fbPostId}`;
}

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

  const todayStr = new Date().toDateString();
  const scheduledRecords = records.filter((r) => r.status === "scheduled");
  const postedRecords = records.filter((r) => r.status === "posted");
  const postedTodayCount = postedRecords.filter((r) => {
    const when = r.publishedAt ?? r.createdAt;
    return new Date(when).toDateString() === todayStr;
  }).length;

  const nextScheduled = [...scheduledRecords].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  )[0];

  const stats = [
    {
      label: "Scheduled",
      value: String(scheduledRecords.length),
      icon: Clock,
      hint: nextScheduled
        ? `Next: ${new Date(nextScheduled.scheduledAt).toLocaleString()}`
        : "Nothing pending",
    },
    {
      label: "Posted today",
      value: String(postedTodayCount),
      icon: CircleCheck,
      hint:
        postedTodayCount === 0
          ? "No posts yet today"
          : `${postedTodayCount === 1 ? "post" : "posts"} published today`,
    },
    {
      label: "Total posts",
      value: String(postedRecords.length),
      icon: Activity,
      hint: `${records.length} record${records.length === 1 ? "" : "s"} all-time`,
    },
  ];

  const now = Date.now();
  const upcoming = [...scheduledRecords]
    .filter((r) => new Date(r.scheduledAt).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 5);

  const recent = [...records]
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 6);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <LayoutDashboard className="size-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            A quiet snapshot of your reposting pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardDescription>{s.label}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight">
                    {s.value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-tight">Tools</h2>
              <span className="text-xs text-muted-foreground">
                {tools.filter((t) => t.available).length} available
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {tools.map((t) => {
                const Icon = t.icon;
                const inner = (
                  <Card
                    className={
                      t.available
                        ? "h-full cursor-pointer transition-colors group-hover:border-foreground/40"
                        : "h-full opacity-60"
                    }
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card">
                          <Icon className="size-4" />
                        </div>
                        {t.available ? (
                          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        ) : (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Soon
                          </span>
                        )}
                      </div>
                      <CardTitle className="mt-3 text-base">{t.title}</CardTitle>
                      <CardDescription>{t.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );

                return t.available ? (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="group block focus:outline-none"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={t.href} className="group block">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
              <h2 className="mb-3 text-sm font-medium tracking-tight">
                Upcoming
              </h2>
              <Card>
                <CardContent className="p-0">
                  {upcoming.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      Nothing scheduled. Queue posts in{" "}
                      <Link href="/reposting" className="underline">
                        Reposting
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {upcoming.map((r) => (
                        <li
                          key={r.fbPostId + r.scheduledAt}
                          className="flex items-start justify-between gap-3 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium tracking-tight text-amber-500">
                              <Clock className="size-3.5" />
                              {new Date(r.scheduledAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                              <FlowBadge flow={r.flow} />
                              <span
                                className="truncate text-[10px] font-normal text-muted-foreground"
                                title={r.accountName}
                              >
                                {r.accountName}
                              </span>
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {r.caption || r.url}
                            </div>
                          </div>
                          <span
                            className="shrink-0 text-xs text-muted-foreground"
                            title={new Date(r.scheduledAt).toLocaleString()}
                          >
                            {relativeTime(r.scheduledAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium tracking-tight">
                Recent posts
              </h2>
              <Card>
              <CardContent className="p-0">
                {recent.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No reposting activity yet. Head to{" "}
                    <Link href="/reposting" className="underline">
                      Reposting
                    </Link>{" "}
                    to schedule your first post.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {recent.map((r) => {
                      const isPosted = r.status === "posted";
                      const isFailed = r.status === "failed";
                      const destUrl = destinationUrl(r);
                      const destLabel =
                        r.flow === "ig-to-yt" ? "Open on YouTube" : "Open on Facebook";
                      return (
                        <li
                          key={r.fbPostId + r.createdAt}
                          className="flex items-start justify-between gap-3 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium tracking-tight">
                              {isPosted ? (
                                <span className="flex items-center gap-1 text-green-500">
                                  <CircleCheck className="size-3.5" /> Posted
                                </span>
                              ) : isFailed ? (
                                <span className="text-red-500">Failed</span>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <Clock className="size-3.5" /> Scheduled
                                </span>
                              )}
                              <FlowBadge flow={r.flow} />
                              <span
                                className="truncate text-[10px] font-normal text-muted-foreground"
                                title={r.accountName}
                              >
                                {r.accountName}
                              </span>
                              {isPosted && (
                                <a
                                  href={destUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                  title={destLabel}
                                >
                                  <ExternalLink className="size-3" />
                                </a>
                              )}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {r.caption || r.url}
                            </div>
                          </div>
                          <span
                            className="shrink-0 text-xs text-muted-foreground"
                            title={new Date(
                              isPosted && r.publishedAt
                                ? r.publishedAt
                                : r.scheduledAt,
                            ).toLocaleString()}
                          >
                            {relativeTime(
                              isPosted && r.publishedAt
                                ? r.publishedAt
                                : r.scheduledAt,
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
