import { mkdir, readFile, rename, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { runMigration } from "./migrate";

export type Flow = "yt-to-fb" | "ig-to-yt";
export const FLOWS: Flow[] = ["yt-to-fb", "ig-to-yt"];

export type RepostingAccount = {
  id: string;
  name: string;
  flow: Flow;
  createdAt: string;
};

export const REPOSTING_DIR = join(process.cwd(), "data", "reposting");
const ACCOUNTS_FILE = join(REPOSTING_DIR, "accounts.json");

export function accountDir(id: string): string {
  return join(REPOSTING_DIR, id);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let _migrated = false;
async function ensureReady(): Promise<void> {
  await mkdir(REPOSTING_DIR, { recursive: true });
  if (!_migrated) {
    _migrated = true;
    await runMigration().catch(() => {
      _migrated = false;
    });
  }
}

async function readAccountsFile(): Promise<RepostingAccount[]> {
  try {
    const text = await readFile(ACCOUNTS_FILE, "utf8");
    return JSON.parse(text) as RepostingAccount[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAccountsFile(accounts: RepostingAccount[]): Promise<void> {
  await mkdir(REPOSTING_DIR, { recursive: true });
  await writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2) + "\n");
}

export async function listAccounts(): Promise<RepostingAccount[]> {
  await ensureReady();
  return readAccountsFile();
}

export async function getAccount(id: string): Promise<RepostingAccount | null> {
  const all = await listAccounts();
  return all.find((a) => a.id === id) ?? null;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function addAccount(
  name: string,
  flow: Flow = "yt-to-fb",
): Promise<RepostingAccount> {
  await ensureReady();
  const accounts = await readAccountsFile();
  const trimmed = name.trim() || `Account ${accounts.length + 1}`;
  const account: RepostingAccount = {
    id: genId(),
    name: trimmed,
    flow,
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  await writeAccountsFile(accounts);
  await mkdir(accountDir(account.id), { recursive: true });
  return account;
}

export async function renameAccount(
  id: string,
  name: string,
): Promise<RepostingAccount | null> {
  const accounts = await listAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  accounts[idx] = { ...accounts[idx], name: name.trim() || accounts[idx].name };
  await writeAccountsFile(accounts);
  return accounts[idx];
}

export async function deleteAccount(id: string): Promise<boolean> {
  const accounts = await listAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  accounts.splice(idx, 1);
  await writeAccountsFile(accounts);
  const dir = accountDir(id);
  if (await fileExists(dir)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await rename(dir, `${dir}.deleted.${stamp}`).catch(() => {});
  }
  return true;
}
