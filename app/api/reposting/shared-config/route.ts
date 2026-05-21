import {
  readSharedConfigMasked,
  writeSharedConfig,
} from "@/lib/reposting/config-store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await readSharedConfigMasked());
}

export async function POST(req: Request) {
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
