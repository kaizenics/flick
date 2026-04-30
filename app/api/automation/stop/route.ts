import { stopRun } from "@/lib/automation/runner";
import { DEFAULT_ACCOUNT_ID } from "@/lib/accounts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  const result = stopRun(accountId);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
