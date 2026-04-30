import Link from "next/link";

const groups = [
  {
    title: "Product",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Flow", href: "/flow" },
      { label: "Engagement", href: "/engagement" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "FAQ", href: "#faq" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M5 19V5" />
                  <path d="M5 5h9a4 4 0 0 1 0 8H5" />
                  <path d="M14 13l5 6" />
                </svg>
              </span>
              <span className="text-sm font-semibold tracking-tight">
                Lifty
              </span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Lift every Page, on autopilot. A quiet control room for
              multi-account Facebook automation.
            </p>
          </div>

          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {g.title}
              </span>
              <ul className="flex flex-col gap-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Lifty. All rights reserved.</span>
          <span>Crafted for operators.</span>
        </div>
      </div>
    </footer>
  );
}
