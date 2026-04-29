import { readConfig, writeConfig, type Config } from "@/lib/store";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await readConfig());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Config>;
  const current = await readConfig();
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
  await writeConfig(next);
  return Response.json(next);
}
