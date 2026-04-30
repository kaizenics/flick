import { readConfig, writeConfig, type Config } from "@/lib/store";
import { DEFAULT_ACCOUNT_ID } from "@/lib/accounts";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  return Response.json(await readConfig(accountId));
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  const body = (await req.json()) as Partial<Config>;
  const current = await readConfig(accountId);
  const next: Config = {
    targetUrl:
      typeof body.targetUrl === "string" ? body.targetUrl.trim() : current.targetUrl,
    sources: Array.isArray(body.sources)
      ? body.sources.map((s) => ({
          id: s.id ?? crypto.randomUUID(),
          name: String(s.name ?? "").trim(),
          note: s.note?.toString(),
        }))
      : current.sources,
  };
  await writeConfig(next, accountId);
  return Response.json(next);
}
