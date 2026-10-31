const items = [
  {
    q: "What does Flick actually do?",
    a: "It takes short videos from YouTube Shorts, TikTok or Instagram Reels, downloads them, writes a caption and schedules them to a Facebook Page or a YouTube channel. Around that sit Page engagement, a visual flow builder, a scraper for viral candidates and a video editor.",
  },
  {
    q: "Who writes the captions?",
    a: "A model through OpenRouter writes them from the video's title and details, or you type your own. You can pick a caption for each video before it is scheduled.",
  },
  {
    q: "Where does it run?",
    a: "On your own machine or a VPS. The pipeline calls yt-dlp and ffmpeg and keeps its state on disk, so serverless hosts such as Vercel will not work.",
  },
  {
    q: "Where is my data kept?",
    a: "In the data folder on the host: the reposting setup, schedule history and Facebook session state. API keys are stored there in plain text, because Flick assumes a single operator on a machine they control.",
  },
  {
    q: "Posting worked yesterday and stopped today. Why?",
    a: "Facebook Page tokens expire about every 60 days. Reconnect the Page in the dashboard before looking for anything else.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="grid gap-12 px-5 pb-32 md:px-8 md:pb-48 lg:grid-cols-12">
      <div className="lg:col-span-5 lg:sticky lg:top-12 lg:self-start">
        <h2 data-reveal className="max-w-md text-4xl leading-[1.02] font-semibold tracking-[-0.03em] md:text-6xl">
          Questions, answered.
        </h2>
        <p data-reveal className="mt-6 max-w-sm text-lg leading-relaxed text-white">
          The rest becomes clear the first time you watch a run move through the pipeline.
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:col-span-7">
        {items.map((item, i) => (
          <details
            key={item.q}
            data-reveal
            open={i === 0}
            className="group rounded-2xl bg-card px-6 py-5 transition-colors open:bg-muted md:px-8 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-6 rounded-lg text-lg font-medium tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              {item.q}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                aria-hidden
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </summary>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
