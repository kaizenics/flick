import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-32 md:pt-40">
      <div className="mb-10 flex flex-col items-start gap-6 md:mb-12">
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Lifty
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground md:text-base">
          Visual automation workspace for Facebook operations.
        </p>
        <div className="flex flex-col items-start gap-3 sm:flex-row">
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
            Open flow
          </Link>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40 p-4 shadow-sm md:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "rgba(34,197,94,0.16)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "rgba(56,189,248,0.16)" }}
        />

        <div className="relative grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/85 p-4 md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Live Flow</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">
                Running
              </span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="h-2 w-28 rounded bg-foreground/80" />
                <div className="mt-2 h-2 w-44 rounded bg-muted-foreground/40" />
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="h-2 w-36 rounded bg-foreground/80" />
                <div className="mt-2 h-2 w-52 rounded bg-muted-foreground/40" />
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="h-2 w-24 rounded bg-foreground/80" />
                <div className="mt-2 h-2 w-40 rounded bg-muted-foreground/40" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/85 p-4">
            <span className="text-xs text-muted-foreground">Queue</span>
            <div className="mt-4 space-y-2">
              <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                Scheduled
              </div>
              <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                In progress
              </div>
              <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                Done
              </div>
            </div>
            <div className="mt-6 rounded-lg border border-border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">Accounts</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">12</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
