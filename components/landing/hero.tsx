import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const features = [
  {
    title: "Engagement at scale",
    description:
      "Drive follows, likes, and reactions from a fleet of accounts with one orchestrated run.",
  },
  {
    title: "Visual flow builder",
    description:
      "Compose pipelines on a node canvas and watch each step execute in real time.",
  },
  {
    title: "Account-aware",
    description:
      "Persisted sessions, smart pacing, and per-account isolation keep workloads stable.",
  },
];

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-32 md:pt-40">
      <div className="flex flex-col items-center pb-24 text-center md:pb-32">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Quietly automating Pages since day one
        </span>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Lift every Page,
          <br className="hidden sm:block" />
          <span className="text-muted-foreground">on autopilot.</span>
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-base text-muted-foreground md:text-lg">
          Lifty orchestrates Facebook engagement across your accounts — follows,
          likes, reactions, page creation — all from one quiet, visual control
          room.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className={buttonVariants({ size: "lg" }) + " cursor-pointer"}
          >
            Open dashboard
          </Link>
          <Link
            href="/flow"
            className={
              buttonVariants({ size: "lg", variant: "ghost" }) +
              " cursor-pointer text-muted-foreground hover:text-foreground"
            }
          >
            See the flow →
          </Link>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex flex-col gap-2 bg-background p-6 transition-colors hover:bg-card/60"
          >
            <h3 className="text-sm font-medium tracking-tight">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {f.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
