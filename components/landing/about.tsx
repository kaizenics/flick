import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const tools = [
  {
    name: "Reposting",
    href: "/reposting",
    text: "Shorts, TikToks and Reels to a Facebook Page or YouTube channel, on a timetable you set.",
  },
  {
    name: "Page engagement",
    href: "/engagement",
    text: "Follows, likes and reactions on Facebook Pages, paced like a person and run from saved sessions.",
  },
  {
    name: "Automation flow",
    href: "/flow",
    text: "Wire steps together on a canvas and watch each node light up as it runs.",
  },
  {
    name: "Scraping",
    href: "/scraping",
    text: "Finds short videos that are already doing well, so the queue starts with candidates worth posting.",
  },
  {
    name: "Video editor",
    href: "/video-editor",
    text: "Trim and rework a clip with ffmpeg before it goes out.",
  },
];

export function About() {
  return (
    <section id="about" className="grid gap-12 px-5 pb-32 md:px-8 md:pb-48 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <h2 data-reveal className="max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.03em] md:text-6xl">
          Five tools on one machine.
        </h2>
        <p data-reveal className="mt-6 max-w-md text-lg leading-relaxed text-white">
          Lifty runs on your own computer or a VPS, for one operator. The queue, the schedule history and
          the Facebook sessions stay in a folder on that host.
        </p>
      </div>

      <ul className="flex flex-col gap-2 lg:col-span-7">
        {tools.map((t) => (
          <li key={t.name} data-reveal>
            <Link
              href={t.href}
              className="group grid gap-2 rounded-2xl bg-card px-6 py-6 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-white md:grid-cols-[14rem_1fr_auto] md:items-baseline md:gap-8 md:px-8"
            >
              <span className="text-2xl font-semibold tracking-tight">{t.name}</span>
              <span className="text-base leading-relaxed text-muted-foreground">{t.text}</span>
              <ArrowUpRight
                aria-hidden
                className="hidden size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white md:block"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
