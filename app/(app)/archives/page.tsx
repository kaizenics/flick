import Link from "next/link";
import { Archive, ExternalLink, Repeat2 } from "lucide-react";
import { listScheduleRecords } from "@/lib/reposting/schedule-store";
import { listAccounts, type Flow } from "@/lib/reposting/accounts-store";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/icons/brand";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type EnrichedRecord = Awaited<ReturnType<typeof listScheduleRecords>>[number] & {
  flow: Flow;
  accountId: string;
  accountName: string;
};

function FlowBadge({ flow }: { flow: Flow }) {
  const [From, fromClass, To, toClass] =
    flow === "yt-to-fb"
      ? [YoutubeIcon, "text-[#ff0000]", FacebookIcon, "text-[#1877f2]"]
      : flow === "tt-to-fb"
        ? [TiktokIcon, undefined, FacebookIcon, "text-[#1877f2]"]
        : [InstagramIcon, "text-[#e4405f]", YoutubeIcon, "text-[#ff0000]"];
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <From size={14} className={fromClass} />
      <span className="text-xs">→</span>
      <To size={14} className={toClass} />
    </span>
  );
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function destinationUrl(r: EnrichedRecord): string {
  if (r.flow === "ig-to-yt") return `https://youtu.be/${r.fbPostId}`;
  return `https://www.facebook.com/${r.fbPostId}`;
}

export default async function ArchivesPage() {
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

  const archived = allRecords
    .flat()
    .filter((r) => r.status === "posted" || r.status === "scheduled")
    .sort((a, b) => {
      const aTs = new Date(a.publishedAt ?? a.scheduledAt ?? a.createdAt).getTime();
      const bTs = new Date(b.publishedAt ?? b.scheduledAt ?? b.createdAt).getTime();
      return bTs - aTs;
    });

  const postedCount = archived.filter((r) => r.status === "posted").length;

  return (
    <>
      <AppTopbar title="Archives" icon={Archive} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-7 pb-16 md:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-xl font-semibold">Archives</h1>
            <p className="text-sm text-muted-foreground">
              {archived.length === 0
                ? "Nothing has been scheduled or posted from any account yet."
                : `${postedCount} posted and ${archived.length - postedCount} scheduled across ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}.`}
            </p>
          </div>
          <Button render={<Link href="/reposting" />} nativeButton={false}>
            <Repeat2 data-icon="inline-start" /> Open reposting
          </Button>
        </div>

        <div className="flex flex-col rounded-[20px] bg-card">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="text-base font-medium">
              Scheduled and posted <span className="num font-normal text-muted-foreground">{archived.length}</span>
            </h2>
          </div>
          {archived.length === 0 ? (
            <p className="border-t border-border px-5 py-6 text-sm text-faint">
              No URLs yet. Runs from Reposting land here once a post is scheduled or published.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="px-5 py-2.5 font-normal">Status</th>
                    <th className="px-3 py-2.5 font-normal">Source and caption</th>
                    <th className="px-3 py-2.5 font-normal">Account</th>
                    <th className="px-3 py-2.5 text-right font-normal">When</th>
                    <th className="px-5 py-2.5 text-right font-normal">Post</th>
                  </tr>
                </thead>
                <tbody>
                  {archived.map((r) => {
                    const eventAt = r.status === "posted" ? (r.publishedAt ?? r.createdAt) : r.scheduledAt;
                    return (
                      <tr key={`${r.accountId}-${r.fbPostId}-${r.createdAt}`} className="border-t border-border align-top">
                        <td className="px-5 py-3.5">
                          <Badge variant={r.status === "posted" ? "positive" : "neutral"}>
                            {r.status === "posted" ? "Posted" : "Scheduled"}
                          </Badge>
                        </td>
                        <td className="max-w-0 px-3 py-3.5">
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="block truncate hover:underline">
                            {r.url}
                          </a>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.caption || "—"}</p>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <FlowBadge flow={r.flow} />
                            <span className="text-muted-foreground">{r.accountName}</span>
                          </div>
                        </td>
                        <td className="num px-3 py-3.5 text-right whitespace-nowrap">{eventAt ? fmtWhen(eventAt) : "—"}</td>
                        <td className="px-5 py-3.5 text-right">
                          <a
                            href={destinationUrl(r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground transition-colors hover:text-white"
                          >
                            Open <ExternalLink className="size-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
