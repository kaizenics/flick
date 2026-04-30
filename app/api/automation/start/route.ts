import { startRun, type Speed } from "@/lib/automation/runner";
import { DEFAULT_ACCOUNT_ID } from "@/lib/accounts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account") ?? DEFAULT_ACCOUNT_ID;
  let body: { headless?: boolean; speed?: Speed } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const result = await startRun({
    headless: body.headless ?? true,
    speed: body.speed ?? "normal",
    accountId,
  });
  if (!result.ok) return Response.json(result, { status: 409 });
  return Response.json(result);
}
