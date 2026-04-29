import { getStatus } from "@/lib/automation/runner";
import { hasStorageState } from "@/lib/automation/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ...getStatus(),
    hasSession: await hasStorageState(),
  });
}
