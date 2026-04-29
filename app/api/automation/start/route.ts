import { startRun, type Speed } from "@/lib/automation/runner";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { headless?: boolean; speed?: Speed } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const result = await startRun({
    headless: body.headless ?? true,
    speed: body.speed ?? "normal",
  });
  if (!result.ok) return Response.json(result, { status: 409 });
  return Response.json(result);
}
