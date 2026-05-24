import {
  createProject,
  listProjectSummaries,
} from "@/lib/video-editor/store";

export const runtime = "nodejs";

export async function GET() {
  const items = await listProjectSummaries();
  return Response.json({ items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const project = await createProject(body.name);
  return Response.json({ project });
}
