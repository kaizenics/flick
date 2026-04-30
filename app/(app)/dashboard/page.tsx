import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Workflow,
  FileStack,
  Smile,
  Activity,
  Users,
  Zap,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const stats = [
  { label: "Active accounts", value: "12", icon: Users, hint: "+2 this week" },
  { label: "Runs today", value: "84", icon: Activity, hint: "98% success" },
  { label: "Avg. throughput", value: "1.4k/h", icon: Zap, hint: "Stable" },
];

const tools = [
  {
    href: "/engagement",
    title: "Page Engagement",
    description:
      "Follow, like, and engage with a target Page across multiple accounts.",
    icon: Heart,
    available: true,
  },
  {
    href: "/flow",
    title: "Automation Flow",
    description:
      "Node-based view of the engagement pipeline with live execution highlighting.",
    icon: Workflow,
    available: true,
  },
  {
    href: "/page-creation",
    title: "Page Creation",
    description: "Spin up new Facebook Pages in bulk from a logged-in account.",
    icon: FileStack,
    available: false,
  },
  {
    href: "/reactions",
    title: "Reactions",
    description: "Drop reactions on a target post from each of your owned Pages.",
    icon: Smile,
    available: false,
  },
];

const activity = [
  { who: "Engagement run", what: "Completed on 8 accounts", when: "2m ago" },
  { who: "Flow", what: "Updated graph: target-page-x", when: "1h ago" },
  { who: "Engagement run", what: "Started on 12 accounts", when: "3h ago" },
  { who: "Account", what: "Session refreshed: ops-04", when: "Yesterday" },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            A quiet snapshot of your automation suite.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardDescription>{s.label}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight">
                    {s.value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.hint}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-tight">Tools</h2>
              <span className="text-xs text-muted-foreground">
                {tools.filter((t) => t.available).length} available
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tools.map((t) => {
                const Icon = t.icon;
                const inner = (
                  <Card
                    className={
                      t.available
                        ? "h-full cursor-pointer transition-colors group-hover:border-foreground/40"
                        : "h-full opacity-60"
                    }
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card">
                          <Icon className="size-4" />
                        </div>
                        {t.available ? (
                          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        ) : (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Soon
                          </span>
                        )}
                      </div>
                      <CardTitle className="mt-3 text-base">
                        {t.title}
                      </CardTitle>
                      <CardDescription>{t.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );

                return t.available ? (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="group block focus:outline-none"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={t.href} className="group block">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium tracking-tight">
              Recent activity
            </h2>
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {activity.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium tracking-tight">
                          {a.who}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.what}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {a.when}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
