import { clearLogs } from "@/lib/logs";
import { DEFAULT_ACCOUNT_ID } from "@/lib/accounts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  clearLogs(accountId);
  return Response.json({ ok: true });
}
