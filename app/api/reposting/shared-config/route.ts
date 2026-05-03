import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  readSharedConfigMasked,
  writeSharedConfig,
} from "@/lib/reposting/config-store";

export const runtime = "nodejs";

async function requireUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET() {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await readSharedConfigMasked());
}

export async function POST(req: Request) {
  if (!(await requireUserId()))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    youtubeApiKey?: string;
    openrouterApiKey?: string;
    openrouterModel?: string;
  };
  await writeSharedConfig({
    youtubeApiKey: body.youtubeApiKey,
    openrouterApiKey: body.openrouterApiKey,
    openrouterModel: body.openrouterModel,
  });
  return Response.json(await readSharedConfigMasked());
}
