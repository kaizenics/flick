import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { readConfigMasked, writeConfig } from "@/lib/reposting/config-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const masked = await readConfigMasked();
  return Response.json(masked);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    youtubeApiKey?: string;
    openrouterApiKey?: string;
    openrouterModel?: string;
    fbPageAccessToken?: string;
  };

  await writeConfig({
    youtubeApiKey: body.youtubeApiKey,
    openrouterApiKey: body.openrouterApiKey,
    openrouterModel: body.openrouterModel,
    fbPageAccessToken: body.fbPageAccessToken,
  });

  const masked = await readConfigMasked();
  return Response.json(masked);
}
