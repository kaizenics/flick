import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { REPOSTING_DIR, accountDir } from "./accounts-store";

const SHARED_FILE = join(REPOSTING_DIR, "shared.json");

export type SharedConfig = {
  youtubeApiKey?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
};

export type AccountConfig = {
  fbPageAccessToken?: string;
  defaultPageId?: string;
};

export type ResolvedConfig = SharedConfig & AccountConfig;

type ConfigField = { set: boolean; value: string | null; masked: string | null };
type PlainField = { set: boolean; value: string | null };

export type MaskedSharedConfig = {
  youtubeApiKey: ConfigField;
  openrouterApiKey: ConfigField;
  openrouterModel: PlainField;
};

export type MaskedAccountConfig = {
  fbPageAccessToken: ConfigField;
  defaultPageId: PlainField;
};

function mask(value: string | undefined): ConfigField {
  if (!value) return { set: false, value: null, masked: null };
  const tail = value.slice(-4);
  // Never send the secret itself back to the browser; the UI only needs set + masked.
  return { set: true, value: null, masked: `••••••${tail}` };
}

async function readJson<T extends object>(file: string): Promise<T> {
  try {
    const text = await readFile(file, "utf8");
    return JSON.parse(text) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {} as T;
    throw e;
  }
}

async function writeJson(file: string, data: object): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
}

function configFile(accountId: string): string {
  return join(accountDir(accountId), "config.json");
}

// Shared (cross-account) -----------------------------------------------------

export async function readSharedConfig(): Promise<SharedConfig> {
  const file = await readJson<SharedConfig>(SHARED_FILE);
  return {
    youtubeApiKey: file.youtubeApiKey || process.env.YOUTUBE_API_KEY,
    openrouterApiKey: file.openrouterApiKey || process.env.OPENROUTER_API_KEY,
    openrouterModel: file.openrouterModel || process.env.OPENROUTER_MODEL,
  };
}

export async function readSharedConfigMasked(): Promise<MaskedSharedConfig> {
  const cfg = await readSharedConfig();
  return {
    youtubeApiKey: mask(cfg.youtubeApiKey),
    openrouterApiKey: mask(cfg.openrouterApiKey),
    openrouterModel: cfg.openrouterModel
      ? { set: true, value: cfg.openrouterModel }
      : { set: false, value: null },
  };
}

export async function writeSharedConfig(patch: Partial<SharedConfig>): Promise<void> {
  const current = await readJson<SharedConfig>(SHARED_FILE);
  const next: SharedConfig = { ...current };
  for (const key of ["youtubeApiKey", "openrouterApiKey", "openrouterModel"] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === "") delete next[key];
    else next[key] = v.trim();
  }
  await writeJson(SHARED_FILE, next);
}

// Per-account ---------------------------------------------------------------

export async function readAccountConfig(accountId: string): Promise<AccountConfig> {
  const file = await readJson<AccountConfig>(configFile(accountId));
  return {
    fbPageAccessToken: file.fbPageAccessToken || process.env.FB_PAGE_ACCESS_TOKEN,
    defaultPageId: file.defaultPageId,
  };
}

export async function readAccountConfigMasked(
  accountId: string,
): Promise<MaskedAccountConfig> {
  const cfg = await readAccountConfig(accountId);
  return {
    fbPageAccessToken: mask(cfg.fbPageAccessToken),
    defaultPageId: cfg.defaultPageId
      ? { set: true, value: cfg.defaultPageId }
      : { set: false, value: null },
  };
}

export async function writeAccountConfig(
  accountId: string,
  patch: Partial<AccountConfig>,
): Promise<void> {
  const current = await readJson<AccountConfig>(configFile(accountId));
  const next: AccountConfig = { ...current };
  for (const key of ["fbPageAccessToken", "defaultPageId"] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === "") delete next[key];
    else next[key] = v.trim();
  }
  await writeJson(configFile(accountId), next);
}

// Resolved (used by run pipeline) -------------------------------------------

export async function readResolvedConfig(accountId: string): Promise<ResolvedConfig> {
  const [shared, perAccount] = await Promise.all([
    readSharedConfig(),
    readAccountConfig(accountId),
  ]);
  return { ...shared, ...perAccount };
}
