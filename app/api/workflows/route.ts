import { createWorkflow, listWorkflowsMeta } from "@/lib/workflows-store";

export const runtime = "nodejs";

export async function GET() {
  const items = await listWorkflowsMeta();
  return Response.json({ items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    data?: { nodes: unknown[]; edges: unknown[] };
  };
  const created = await createWorkflow({
    name: body.name,
    data: body.data,
  });
  return Response.json(created);
}
