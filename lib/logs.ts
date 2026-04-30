import fs from "node:fs";
import path from "node:path";
import { DEFAULT_ACCOUNT_ID, logsPath } from "./accounts";
import { accountContext } from "./automation/browser";

export type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  source?: string;
  target?: string;
  status?:
    | "followed"
    | "liked"
    | "already-following"
    | "already-liked"
    | "not-supported"
    | "error"
    | "started"
    | "stopped";
  message: string;
};

const RING_SIZE = 500;

type AccountLogs = {
  ring: LogEntry[];
  subscribers: Set<(e: LogEntry) => void>;
};

const byAccount = new Map<string, AccountLogs>();

function getBucket(accountId: string): AccountLogs {
  let b = byAccount.get(accountId);
  if (!b) {
    b = { ring: [], subscribers: new Set() };
    byAccount.set(accountId, b);
  }
  return b;
}

function resolveAccountId(explicit?: string): string {
  return explicit ?? accountContext.getStore() ?? DEFAULT_ACCOUNT_ID;
}

function ensureFile(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "");
}

export function appendLog(entry: Omit<LogEntry, "ts">, accountId?: string): LogEntry {
  const id = resolveAccountId(accountId);
  const file = logsPath(id);
  const bucket = getBucket(id);
  const full: LogEntry = { ts: new Date().toISOString(), ...entry };
  ensureFile(file);
  fs.appendFileSync(file, JSON.stringify(full) + "\n");
  bucket.ring.push(full);
  if (bucket.ring.length > RING_SIZE) bucket.ring.shift();
  for (const fn of bucket.subscribers) {
    try {
      fn(full);
    } catch {
      // ignore
    }
  }
  return full;
}

export function recentLogs(limit = 200, accountId?: string): LogEntry[] {
  const id = resolveAccountId(accountId);
  const bucket = getBucket(id);
  if (bucket.ring.length >= limit) return bucket.ring.slice(-limit);
  const file = logsPath(id);
  ensureFile(file);
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split("\n").filter(Boolean).slice(-limit);
  return lines
    .map((l) => {
      try {
        return JSON.parse(l) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is LogEntry => x !== null);
}

export function subscribe(fn: (e: LogEntry) => void, accountId?: string) {
  const id = resolveAccountId(accountId);
  const bucket = getBucket(id);
  bucket.subscribers.add(fn);
  return () => bucket.subscribers.delete(fn);
}

export function clearLogs(accountId?: string) {
  const id = resolveAccountId(accountId);
  const file = logsPath(id);
  ensureFile(file);
  fs.writeFileSync(file, "");
  const bucket = getBucket(id);
  bucket.ring.length = 0;
  // Notify subscribers with a sentinel "cleared" entry so the UI can drop
  // its in-memory list.
  const cleared: LogEntry = {
    ts: new Date().toISOString(),
    level: "info",
    message: "__cleared__",
  };
  for (const fn of bucket.subscribers) {
    try {
      fn(cleared);
    } catch {
      // ignore
    }
  }
}
