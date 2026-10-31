import Link from "next/link";
import { Check, Download, FileSearch, Loader2, Sparkles, CalendarClock } from "lucide-react";
import { YoutubeIcon, FacebookIcon } from "@/components/icons/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "done" | "active" | "idle";

// Mirrors the six stages of the reposting canvas in components/dashboard/RepostingPanel.tsx.
const stages: { label: string; detail: string; icon: React.ReactNode; status: Status }[] = [
  { label: "Source", detail: "5 Shorts queued", icon: <YoutubeIcon size={16} className="text-[#ff0000]" />, status: "done" },
  { label: "Read details", detail: "Title, channel, length", icon: <FileSearch className="size-4" />, status: "done" },
  { label: "Download", detail: "yt-dlp, best mp4", icon: <Download className="size-4" />, status: "done" },
  { label: "Caption", detail: "AI-written, 3 of 5", icon: <Sparkles className="size-4" />, status: "active" },
  { label: "Schedule", detail: "Facebook Graph API", icon: <CalendarClock className="size-4" />, status: "idle" },
  { label: "Facebook", detail: "Your Page", icon: <FacebookIcon size={16} className="text-[#1877f2]" />, status: "idle" },
];

const queue: { title: string; when: string; status: string; tone: Status }[] = [
  { title: "Short 1 of 5", when: "Posted today, 09:00", status: "Posted", tone: "done" },
  { title: "Short 2 of 5", when: "Posted today, 13:00", status: "Posted", tone: "done" },
  { title: "Short 3 of 5", when: "Writing caption", status: "Running", tone: "active" },
  { title: "Short 4 of 5", when: "Tomorrow, 09:00", status: "Scheduled", tone: "idle" },
];

function StatusMark({ status }: { status: Status }) {
  if (status === "done")
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-data text-black" aria-label="Done">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (status === "active")
    return <Loader2 className="size-4 animate-spin text-white" aria-label="Running" />;
  return <span className="size-2 rounded-full bg-raised" aria-label="Waiting" />;
}

export function Hero() {
  return (
    <section className="px-5 pb-24 md:px-8 md:pb-40">
      <nav className="flex items-center justify-between py-6" aria-label="Main">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Flick
        </Link>
        <div className="flex items-center gap-6 text-[15px] md:gap-8">
          <Link href="/reposting" className="hidden text-muted-foreground transition-colors hover:text-white sm:inline">
            Reposting
          </Link>
          <Link href="/flow" className="hidden text-muted-foreground transition-colors hover:text-white sm:inline">
            Flow
          </Link>
          <Link href="#faq" className="text-muted-foreground transition-colors hover:text-white">
            FAQ
          </Link>
          <Link href="/dashboard" className="font-medium text-white underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </nav>

      <div className="grid gap-10 pt-16 md:pt-28 lg:grid-cols-12 lg:items-end">
        <h1
          data-reveal
          className="text-[2.1rem] leading-[0.95] font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:col-span-8 lg:text-[6.4vw]"
        >
          Flick reposts Shorts to Facebook.
        </h1>
        <div data-reveal className="flex flex-col items-start gap-6 lg:col-span-4 lg:pb-3">
          <p className="max-w-md text-lg leading-relaxed text-white">
            Queue YouTube Shorts, TikToks or Reels. Flick downloads each one, writes the caption and
            schedules it to your Facebook Page or YouTube channel.
          </p>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 bg-data px-7 text-base text-black hover:bg-white focus-visible:ring-data/50",
            )}
          >
            Open the dashboard
          </Link>
        </div>
      </div>

      <div data-ui data-reveal className="mt-16 rounded-3xl bg-card p-4 md:mt-24 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1 pb-5 md:pb-7">
          <p className="text-base font-medium">YouTube Shorts to Facebook Page</p>
          <p className="num text-sm text-muted-foreground">Run in progress, 2 of 5 posted</p>
        </div>

        <ol className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {stages.map((s) => (
            <li
              key={s.label}
              className={cn(
                "flex min-h-36 flex-col justify-between gap-6 rounded-2xl p-4",
                s.status === "active" ? "bg-raised" : "bg-muted",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-white">{s.icon}</span>
                <StatusMark status={s.status} />
              </div>
              <div>
                <p className="text-[15px] font-medium">{s.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <ul className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {queue.map((q) => (
            <li key={q.title} className="flex items-center justify-between gap-4 rounded-2xl bg-muted px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{q.title}</p>
                <p className="num truncate text-sm text-muted-foreground">{q.when}</p>
              </div>
              <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <StatusMark status={q.tone} />
                {q.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
