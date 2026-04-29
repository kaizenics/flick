import fs from "node:fs";
import path from "node:path";

export type LogEntry = {
  ts: string; // ISO timestamp
  level: "info" | "warn" | "error";
  source?: string; // source page name
  target?: string; // target page url
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

const LOG_PATH = path.join(process.cwd(), "data", "logs.jsonl");

// In-memory ring + pub/sub for the dashboard.
const RING_SIZE = 500;
const ring: LogEntry[] = [];
const subscribers = new Set<(e: LogEntry) => void>();

function ensureFile() {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, "");
}

export function appendLog(entry: Omit<LogEntry, "ts">) {
  const full: LogEntry = { ts: new Date().toISOString(), ...entry };
  ensureFile();
  fs.appendFileSync(LOG_PATH, JSON.stringify(full) + "\n");
  ring.push(full);
  if (ring.length > RING_SIZE) ring.shift();
  for (const fn of subscribers) {
    try {
      fn(full);
    } catch {
      // ignore subscriber errors
    }
  }
  return full;
}

export function recentLogs(limit = 200): LogEntry[] {
  if (ring.length >= limit) return ring.slice(-limit);
  // Fall back to disk if ring isn't warm yet (e.g. fresh process).
  ensureFile();
  const raw = fs.readFileSync(LOG_PATH, "utf8");
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

export function subscribe(fn: (e: LogEntry) => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
