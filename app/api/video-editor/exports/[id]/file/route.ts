import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getRenderById, renderPathFor } from "@/lib/video-editor/store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const render = await getRenderById(id);
  if (!render) return new Response("Not found", { status: 404 });

  const path = renderPathFor(render);
  const fileStat = await stat(path).catch(() => null);
  if (!fileStat) return new Response("Not found", { status: 404 });

  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(fileStat.size),
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${render.projectId}-${render.id}.mp4"`,
    },
  });
}
