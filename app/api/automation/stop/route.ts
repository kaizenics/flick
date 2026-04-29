import { stopRun } from "@/lib/automation/runner";

export const runtime = "nodejs";

export async function POST() {
  const result = stopRun();
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
