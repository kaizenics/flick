import { getStatus } from "@/lib/automation/runner";
import { hasStorageState } from "@/lib/automation/browser";
import { DEFAULT_ACCOUNT_ID } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  return Response.json({
    ...getStatus(accountId),
    hasSession: await hasStorageState(accountId),
  });
}
