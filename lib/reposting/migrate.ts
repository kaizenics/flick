import { mkdir, readFile, writeFile, rename, access } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(process.cwd(), "data");
const REPOSTING_DIR = join(ROOT, "reposting");
const OLD_CONFIG = join(ROOT, "reposting-config.json");
const OLD_SCHEDULE = join(ROOT, "reposting-schedule.jsonl");
const ACCOUNTS_FILE = join(REPOSTING_DIR, "accounts.json");
const SHARED_FILE = join(REPOSTING_DIR, "shared.json");

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

type OldConfig = {
  youtubeApiKey?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  fbPageAccessToken?: string;
};

export async function runMigration(): Promise<void> {
  if (await exists(ACCOUNTS_FILE)) return;
  if (!(await exists(OLD_CONFIG)) && !(await exists(OLD_SCHEDULE))) return;

  await mkdir(REPOSTING_DIR, { recursive: true });
  const defaultDir = join(REPOSTING_DIR, "default");
  await mkdir(defaultDir, { recursive: true });

  let perAccount: { fbPageAccessToken?: string; defaultPageId?: string } = {};
  let shared: {
    youtubeApiKey?: string;
    openrouterApiKey?: string;
    openrouterModel?: string;
  } = {};

  if (await exists(OLD_CONFIG)) {
    try {
      const old = JSON.parse(await readFile(OLD_CONFIG, "utf8")) as OldConfig;
      shared = {
        youtubeApiKey: old.youtubeApiKey,
        openrouterApiKey: old.openrouterApiKey,
        openrouterModel: old.openrouterModel,
      };
      perAccount = { fbPageAccessToken: old.fbPageAccessToken };
    } catch {
      // ignore corrupt old config
    }
  }

  await writeFile(SHARED_FILE, JSON.stringify(shared, null, 2) + "\n", { mode: 0o600 });
  await writeFile(
    join(defaultDir, "config.json"),
    JSON.stringify(perAccount, null, 2) + "\n",
    { mode: 0o600 },
  );

  if (await exists(OLD_SCHEDULE)) {
    const text = await readFile(OLD_SCHEDULE, "utf8");
    await writeFile(join(defaultDir, "schedule.jsonl"), text);
  }

  await writeFile(
    ACCOUNTS_FILE,
    JSON.stringify(
      [
        {
          id: "default",
          name: "Default",
          flow: "yt-to-fb",
          createdAt: new Date().toISOString(),
        },
      ],
      null,
      2,
    ) + "\n",
  );

  if (await exists(OLD_CONFIG)) {
    await rename(OLD_CONFIG, `${OLD_CONFIG}.migrated`).catch(() => {});
  }
  if (await exists(OLD_SCHEDULE)) {
    await rename(OLD_SCHEDULE, `${OLD_SCHEDULE}.migrated`).catch(() => {});
  }
}
