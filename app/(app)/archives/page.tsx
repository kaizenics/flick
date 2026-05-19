import Link from "next/link";
import { Archive, CircleCheck, Clock, ExternalLink } from "lucide-react";
import { listScheduleRecords } from "@/lib/reposting/schedule-store";
import { listAccounts, type Flow } from "@/lib/reposting/accounts-store";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/icons/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

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
  if (flow === "tt-to-fb") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <TiktokIcon size={12} />
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Archive className="size-4" />
        <h1 className="text-sm font-medium">Archives</h1>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scheduled & Posted URLs</CardTitle>
            <CardDescription>
              URLs that are successfully scheduled or already posted in the pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {archived.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posted URLs yet. Start a run from{" "}
                <Link href="/reposting" className="underline">
                  Reposting
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2">
                {archived.map((r) => {
                  const destUrl = destinationUrl(r);
                  const eventAt = r.status === "posted"
                    ? (r.publishedAt ?? r.createdAt)
                    : r.scheduledAt;
                  return (
                    <div key={`${r.accountId}-${r.fbPostId}-${r.createdAt}`} className="rounded-md border p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.status === "posted" ? (
                          <span className="flex items-center gap-1 font-medium text-green-500">
                            <CircleCheck className="size-4" /> Posted
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-medium text-amber-500">
                            <Clock className="size-4" /> Scheduled
                          </span>
                        )}
                        <FlowBadge flow={r.flow} />
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {r.accountName}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(eventAt).toLocaleString()}
                        </span>
                        <a
                          href={destUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          Open post <ExternalLink className="size-3" />
                        </a>
                      </div>
                      <div className="mt-2 break-all text-sm">{r.url}</div>
                      {r.caption ? (
                        <div className="mt-1 line-clamp-2 text-muted-foreground">{r.caption}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
