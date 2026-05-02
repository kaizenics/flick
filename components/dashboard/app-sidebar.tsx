"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Heart,
  Workflow,
  FileStack,
  Smile,
  LifeBuoy,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const navMain = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
];

const navTools = [
  { title: "Page Engagement", href: "/engagement", icon: Heart, available: true },
  { title: "Automation Flow", href: "/flow", icon: Workflow, available: true },
  { title: "Page Creation", href: "/page-creation", icon: FileStack, available: false },
  { title: "Reactions", href: "/reactions", icon: Smile, available: false },
];

const navSecondary = [
  { title: "Support", href: "#", icon: LifeBuoy },
  { title: "Settings", href: "#", icon: Settings },
];

function SidebarToggle({ className }: { className?: string }) {
  const { toggleSidebar, state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={
        "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring " +
        (className ?? "")
      }
    >
      {collapsed ? (
        <PanelLeftOpen className="size-4" />
      ) : (
        <PanelLeftClose className="size-4" />
      )}
    </button>
  );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden
              >
                <path d="M5 19V5" />
                <path d="M5 5h9a4 4 0 0 1 0 8H5" />
                <path d="M14 13l5 6" />
              </svg>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 leading-none">
              <span className="truncate font-semibold tracking-tight">
                Lifty
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Automation suite
              </span>
            </div>
          </Link>
          <SidebarToggle />
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <SidebarToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navTools.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {!item.available && (
                      <SidebarMenuBadge className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Soon
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondary.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      size="sm"
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Operator"
              render={<Link href="/" />}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium">
                L
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 text-left leading-none group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">Operator</span>
                <span className="truncate text-xs text-muted-foreground">
                  admin@lifty.com
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
