import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const TARGETS_PATH = path.join(process.cwd(), "data", "targets.json");

export type SourcePage = {
  id: string;
  name: string; // exact name shown in FB account switcher
  note?: string;
};

export type Config = {
  targetUrl: string; // the Page that should receive follows
  sources: SourcePage[]; // owned Pages that will each follow the target
};

const DEFAULT: Config = {
  targetUrl: "",
  sources: [],
};

async function ensure() {
  await fs.mkdir(path.dirname(TARGETS_PATH), { recursive: true });
  try {
    await fs.access(TARGETS_PATH);
  } catch {
    await fs.writeFile(TARGETS_PATH, JSON.stringify(DEFAULT, null, 2));
  }
}

/**
 * Reads config and migrates the previous schema
 * ({ sourcePageName, targets[] }) to the new one if encountered.
 */
export async function readConfig(): Promise<Config> {
  await ensure();
  const raw = await fs.readFile(TARGETS_PATH, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT;
  }

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
    await fs.writeFile(TARGETS_PATH, JSON.stringify(migrated, null, 2));
    return migrated;
  }

  return { ...DEFAULT, ...(parsed as Config) };
}

export async function writeConfig(cfg: Config): Promise<void> {
  await ensure();
  await fs.writeFile(TARGETS_PATH, JSON.stringify(cfg, null, 2));
}
