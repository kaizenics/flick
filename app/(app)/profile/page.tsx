import { access } from "node:fs/promises";
import { join } from "node:path";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground">
          Local-only mode is active. Authentication is disabled.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mode</CardTitle>
          <CardDescription>
            Runtime assumptions for this private-machine deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Field label="Access model" value="No auth (local trusted machine)" />
          <Field label="Persistence" value="Local files under data/" />
          <Field label="Project root" value={root} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage Paths</CardTitle>
          <CardDescription>
            Presence check for key local files/directories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {paths.map(([name, exists]) => (
            <Field key={name} label={name} value={exists ? "present" : "missing"} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Diagnostics</CardTitle>
          <CardDescription>
            Non-secret configuration status only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {envChecks.map(([name, value]) => (
            <Field key={name} label={name} value={value} />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-card/40 px-3 py-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={mono ? "max-w-[60%] truncate font-mono text-xs" : "text-sm"}>{value}</span>
    </div>
  );
}
