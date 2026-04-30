const items = [
  {
    q: "What does Lifty actually do?",
    a: "Lifty automates engagement actions across multiple Facebook accounts — follows, likes, reactions, and Page creation — from a single visual control room.",
  },
  {
    q: "Is it safe for my accounts?",
    a: "Each account runs in an isolated session with humanlike pacing and persisted state. There is no shared cookie jar and no aggressive bursts.",
  },
  {
    q: "Can I see what is happening in real time?",
    a: "Yes. The flow view highlights each node as it executes, so you always know which step is running on which account.",
  },
  {
    q: "Do I need to keep my computer on?",
    a: "Lifty runs locally for now, so the host machine needs to be awake while a flow is executing. A hosted runner is on the roadmap.",
  },
  {
    q: "Which automations are available today?",
    a: "Page Engagement and the visual Automation Flow ship today. Page Creation and Reactions are next on the queue.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-32 md:flex-row md:items-start md:gap-24"
    >
      <div className="flex-1 md:sticky md:top-32">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          FAQ
        </span>
        <h2 className="mt-4 max-w-sm text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Answers to the usual questions.
        </h2>
        <p className="mt-4 max-w-sm text-sm text-muted-foreground">
          Still curious? Open the dashboard and poke around — most questions
          answer themselves once you see a flow run.
        </p>
      </div>

      <div className="flex-1 divide-y divide-border rounded-xl border border-border">
        {items.map((item) => (
          <details key={item.q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-6 text-sm font-medium tracking-tight outline-none">
              {item.q}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                aria-hidden
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
