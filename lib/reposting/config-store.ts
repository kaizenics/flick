import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FILE = join(process.cwd(), "data", "reposting-config.json");

export type RepostingConfig = {
  youtubeApiKey?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  fbPageAccessToken?: string;
};

export type MaskedConfig = {
  youtubeApiKey: { set: boolean; value: string | null; masked: string | null };
  openrouterApiKey: { set: boolean; value: string | null; masked: string | null };
  openrouterModel: { set: boolean; value: string | null };
  fbPageAccessToken: { set: boolean; value: string | null; masked: string | null };
};

function mask(
  value: string | undefined,
): { set: boolean; value: string | null; masked: string | null } {
  if (!value) return { set: false, value: null, masked: null };
  const tail = value.slice(-4);
  return { set: true, value, masked: `••••••${tail}` };
}

async function readFileConfig(): Promise<RepostingConfig> {
  try {
    const text = await readFile(FILE, "utf8");
    return JSON.parse(text) as RepostingConfig;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}

export async function readConfig(): Promise<RepostingConfig> {
  const file = await readFileConfig();
  return {
    youtubeApiKey: file.youtubeApiKey || process.env.YOUTUBE_API_KEY,
    openrouterApiKey: file.openrouterApiKey || process.env.OPENROUTER_API_KEY,
    openrouterModel: file.openrouterModel || process.env.OPENROUTER_MODEL,
    fbPageAccessToken: file.fbPageAccessToken || process.env.FB_PAGE_ACCESS_TOKEN,
  };
}

export async function readConfigMasked(): Promise<MaskedConfig> {
  const cfg = await readConfig();
  return {
    youtubeApiKey: mask(cfg.youtubeApiKey),
    openrouterApiKey: mask(cfg.openrouterApiKey),
    openrouterModel: cfg.openrouterModel
      ? { set: true, value: cfg.openrouterModel }
      : { set: false, value: null },
    fbPageAccessToken: mask(cfg.fbPageAccessToken),
  };
}

export async function writeConfig(patch: Partial<RepostingConfig>): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  const current = await readFileConfig();
  const next: RepostingConfig = { ...current };
  for (const key of [
    "youtubeApiKey",
    "openrouterApiKey",
    "openrouterModel",
    "fbPageAccessToken",
  ] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === "") delete next[key];
    else next[key] = v.trim();
  }
  await writeFile(FILE, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
}
