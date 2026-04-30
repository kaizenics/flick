import fs from "node:fs/promises";
import crypto from "node:crypto";
import { DEFAULT_ACCOUNT_ID, targetsPath, accountDir } from "./accounts";

export type SourcePage = {
  id: string;
  name: string;
  note?: string;
};

export type Config = {
  targetUrl: string;
  sources: SourcePage[];
};

const DEFAULT: Config = { targetUrl: "", sources: [] };

async function ensure(id: string) {
  await fs.mkdir(accountDir(id), { recursive: true });
  const file = targetsPath(id);
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(DEFAULT, null, 2));
  }
}

export async function readConfig(accountId: string = DEFAULT_ACCOUNT_ID): Promise<Config> {
  await ensure(accountId);
  const file = targetsPath(accountId);
  const raw = await fs.readFile(file, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT;
  }

  // Migrate legacy schema { sourcePageName, targets[] }.
  if (
    parsed &&
    typeof parsed === "object" &&
    ("sourcePageName" in parsed || "targets" in parsed)
  ) {
    const old = parsed as { sourcePageName?: string; targets?: { url?: string }[] };
    const migrated: Config = {
      targetUrl: old.targets?.[0]?.url ?? "",
      sources: old.sourcePageName
        ? [{ id: crypto.randomUUID(), name: old.sourcePageName }]
        : [],
    };
    await fs.writeFile(file, JSON.stringify(migrated, null, 2));
    return migrated;
  }

  return { ...DEFAULT, ...(parsed as Config) };
}

export async function writeConfig(
  cfg: Config,
  accountId: string = DEFAULT_ACCOUNT_ID,
): Promise<void> {
  await ensure(accountId);
  await fs.writeFile(targetsPath(accountId), JSON.stringify(cfg, null, 2));
}
