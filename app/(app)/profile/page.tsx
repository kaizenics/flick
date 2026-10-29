import { access } from "node:fs/promises";
import { join } from "node:path";
import type * as React from "react";
import { Settings } from "lucide-react";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { Badge } from "@/components/ui/badge";

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function status(value: string | undefined): string {
  return value && value.trim().length > 0 ? "configured" : "missing";
}

export default async function ProfilePage() {
  const root = process.cwd();
  const dataDir = join(root, "data");
  const workflowsFile = join(dataDir, "workflows.json");
  const accountsFile = join(dataDir, "accounts.json");
  const repostingDir = join(dataDir, "reposting");

  const envChecks = [
    ["APP_BASE_URL", status(process.env.APP_BASE_URL)],
    ["YT_OAUTH_CLIENT_ID", status(process.env.YT_OAUTH_CLIENT_ID)],
    ["YT_OAUTH_CLIENT_SECRET", status(process.env.YT_OAUTH_CLIENT_SECRET)],
    ["YOUTUBE_API_KEY", status(process.env.YOUTUBE_API_KEY)],
    ["OPENROUTER_API_KEY", status(process.env.OPENROUTER_API_KEY)],
  ] as const;

  const paths = [
    ["data/", await pathExists(dataDir)],
    ["data/workflows.json", await pathExists(workflowsFile)],
    ["data/accounts.json", await pathExists(accountsFile)],
    ["data/reposting/", await pathExists(repostingDir)],
  ] as const;

  const missing = paths.filter(([, exists]) => !exists).length + envChecks.filter(([, v]) => v === "missing").length;

  return (
    <>
      <AppTopbar title="System" icon={Settings} />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-7 pb-16 md:px-7">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-xl font-semibold">System</h1>
          <p className="text-sm text-muted-foreground">
            Local-only mode, authentication off.{" "}
            {missing === 0 ? "All storage paths and settings are in place." : `${missing} ${missing === 1 ? "item is" : "items are"} missing.`}
          </p>
        </div>

        <div className="flex flex-col">
          <SettingsRow title="Mode" description="Runtime assumptions for this private-machine deployment.">
            <Field label="Access model" value="No auth (local trusted machine)" />
            <Field label="Persistence" value="Local files under data/" />
            <Field label="Project root" value={<span className="min-w-0 truncate text-right font-mono text-xs">{root}</span>} />
          </SettingsRow>

          <SettingsRow title="Storage paths" description="Presence check for the key local files and directories.">
            {paths.map(([name, exists]) => (
              <Field
                key={name}
                label={name}
                mono
                value={<Badge variant={exists ? "positive" : "warning"}>{exists ? "Present" : "Missing"}</Badge>}
              />
            ))}
          </SettingsRow>

          <SettingsRow title="Environment" description="Whether each variable is set. Values are never shown.">
            {envChecks.map(([name, value]) => (
              <Field
                key={name}
                label={name}
                mono
                value={
                  <Badge variant={value === "configured" ? "positive" : "warning"}>
                    {value === "configured" ? "Configured" : "Missing"}
                  </Badge>
                }
              />
            ))}
          </SettingsRow>
        </div>
      </div>
    </>
  );
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-border py-8 first:pt-2 last:border-b-0 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-1.5 lg:pt-2">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col rounded-[20px] bg-card px-5 py-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <span className={mono ? "min-w-0 truncate font-mono text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
        {label}
      </span>
      {typeof value === "string" ? <span className="text-right text-sm">{value}</span> : value}
    </div>
  );
}
