const stats = [
  { value: "100+", label: "Accounts orchestrated" },
  { value: "24/7", label: "Quiet background runs" },
  { value: "0", label: "Manual clicks needed" },
];

export function About() {
  return (
    <section
      id="about"
      className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-32 md:flex-row md:items-start md:gap-24"
    >
      <div className="flex-1">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          About
        </span>
        <h2 className="mt-4 max-w-md text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Built for operators who run a lot of Pages.
        </h2>
      </div>

      <div className="flex-1 space-y-6">
        <p className="text-base leading-relaxed text-muted-foreground">
          Lifty turns the noisy work of multi-account Facebook engagement into a
          calm, visual pipeline. You wire up the steps once — follow a target,
          like a post, drop a reaction — and Lifty pilots your accounts through
          it with care.
        </p>
        <p className="text-base leading-relaxed text-muted-foreground">
          Sessions are persisted, pacing is human-shaped, and every account
          stays isolated. You see exactly what is happening, exactly when it
          happens.
        </p>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {stats.map((s) => (
            <div key={s.label} className="bg-background p-5">
              <div className="text-2xl font-semibold tracking-tight">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
