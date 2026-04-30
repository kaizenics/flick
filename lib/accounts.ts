import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type ProxyConfig = {
  server: string; // e.g. "http://1.2.3.4:8080" or "socks5://host:1080"
  username?: string;
  password?: string;
  bypass?: string;
};

export type Account = {
  id: string;
  name: string;
  proxy?: ProxyConfig;
};

const INDEX_PATH = path.join(process.cwd(), "data", "accounts.json");
const ACCOUNTS_DIR = path.join(process.cwd(), "data", "accounts");

export const DEFAULT_ACCOUNT_ID = "default";

export function accountDir(id: string) {
  return path.join(ACCOUNTS_DIR, id);
}
export function storageStatePath(id: string) {
  return path.join(accountDir(id), "storageState.json");
}
export function targetsPath(id: string) {
  return path.join(accountDir(id), "targets.json");
}
export function logsPath(id: string) {
  return path.join(accountDir(id), "logs.jsonl");
}

async function migrateLegacy() {
  const legacy = {
    storage: path.join(process.cwd(), "data", "auth", "storageState.json"),
    targets: path.join(process.cwd(), "data", "targets.json"),
    logs: path.join(process.cwd(), "data", "logs.jsonl"),
  };
  const dest = accountDir(DEFAULT_ACCOUNT_ID);
  await fs.mkdir(dest, { recursive: true });
  for (const [k, p] of Object.entries(legacy)) {
    try {
      await fs.access(p);
    } catch {
      continue;
    }
    const target =
      k === "storage" ? storageStatePath(DEFAULT_ACCOUNT_ID)
        : k === "targets" ? targetsPath(DEFAULT_ACCOUNT_ID)
        : logsPath(DEFAULT_ACCOUNT_ID);
    try {
      await fs.access(target);
    } catch {
      await fs.rename(p, target).catch(() => {});
    }
  }
}

async function ensure() {
  await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
  await migrateLegacy();
  try {
    await fs.access(INDEX_PATH);
  } catch {
    const initial: Account[] = [{ id: DEFAULT_ACCOUNT_ID, name: "Default" }];
    await fs.writeFile(INDEX_PATH, JSON.stringify(initial, null, 2));
    await fs.mkdir(accountDir(DEFAULT_ACCOUNT_ID), { recursive: true });
  }
}

export async function listAccounts(): Promise<Account[]> {
  await ensure();
  const raw = await fs.readFile(INDEX_PATH, "utf8");
  try {
    return JSON.parse(raw) as Account[];
  } catch {
    return [];
  }
}

export async function addAccount(name: string): Promise<Account> {
  await ensure();
  const accounts = await listAccounts();
  const account: Account = {
    id: crypto.randomUUID(),
    name: name.trim() || `Account ${accounts.length + 1}`,
  };
  accounts.push(account);
  await fs.writeFile(INDEX_PATH, JSON.stringify(accounts, null, 2));
  await fs.mkdir(accountDir(account.id), { recursive: true });
  return account;
}

export async function deleteAccount(id: string): Promise<void> {
  if (id === DEFAULT_ACCOUNT_ID) throw new Error("Cannot delete default account");
  const accounts = (await listAccounts()).filter((a) => a.id !== id);
  await fs.writeFile(INDEX_PATH, JSON.stringify(accounts, null, 2));
  await fs.rm(accountDir(id), { recursive: true, force: true }).catch(() => {});
}

export async function renameAccount(id: string, name: string): Promise<void> {
  const accounts = await listAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return;
  acc.name = name;
  await fs.writeFile(INDEX_PATH, JSON.stringify(accounts, null, 2));
}

export async function setProxy(id: string, proxy?: ProxyConfig): Promise<void> {
  const accounts = await listAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return;
  if (proxy && proxy.server.trim()) {
    acc.proxy = {
      server: proxy.server.trim(),
      username: proxy.username?.trim() || undefined,
      password: proxy.password?.trim() || undefined,
      bypass: proxy.bypass?.trim() || undefined,
    };
  } else {
    delete acc.proxy;
  }
  await fs.writeFile(INDEX_PATH, JSON.stringify(accounts, null, 2));
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const accounts = await listAccounts();
  return accounts.find((a) => a.id === id);
}
