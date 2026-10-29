import * as React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

// Shared 64px top bar of the ruled T-frame: page name on the left, the
// page's switcher/actions at the right end behind a full-height divider.
export function AppTopbar({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border bg-background px-4 md:px-7">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <span className="truncate font-medium">{title}</span>
      </div>
      {children && (
        <div className="ml-auto flex h-full min-w-0 items-center gap-2 border-l border-sidebar-border pl-3 md:pl-4">
          {children}
        </div>
      )}
    </header>
  );
}
