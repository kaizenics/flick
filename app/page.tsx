import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tools = [
  {
    href: "/engagement",
    title: "Page Engagement Automation",
    description:
      "Use your owned Pages to follow, like, and engage with a target Page across multiple Facebook accounts.",
    available: true,
  },
  {
    href: "/flow",
    title: "Automation Flow (xyflow)",
    description:
      "Node-based view of the engagement pipeline with live execution highlighting.",
    available: true,
  },
  {
    href: "/page-creation",
    title: "FB Page Creation Automation",
    description:
      "Spin up new Facebook Pages in bulk from a logged-in account. Coming soon.",
    available: false,
  },
  {
    href: "/reactions",
    title: "FB Reactions Automation",
    description:
      "Drop reactions on a target post from each of your owned Pages. Coming soon.",
    available: false,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">FB Automation</h1>
          <p className="text-sm text-muted-foreground">
            Pick a tool to get started.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group focus:outline-none"
              aria-disabled={!t.available}
            >
              <Card
                className={
                  t.available
                    ? "h-full transition-colors group-hover:border-foreground/40 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                    : "h-full opacity-60"
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {t.title}
                    {!t.available && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
