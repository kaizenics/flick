import { createDesign, listDesigns } from "@/lib/design-studio/store";

export const runtime = "nodejs";

export async function GET() {
  const items = await listDesigns();
  return Response.json({ items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; width?: unknown; height?: unknown };
  const design = await createDesign(body);
  return Response.json({ design });
}
