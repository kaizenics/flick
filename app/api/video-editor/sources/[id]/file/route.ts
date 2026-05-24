import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getSourceById, sourcePathFor } from "@/lib/video-editor/store";

export const runtime = "nodejs";

function badRange(size: number): Response {
  return new Response(null, {
    status: 416,
    headers: { "Content-Range": `bytes */${size}` },
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const source = await getSourceById(id);
  if (!source) return new Response("Not found", { status: 404 });

  const path = sourcePathFor(source);
  const fileStat = await stat(path).catch(() => null);
  if (!fileStat) return new Response("Not found", { status: 404 });

  const total = fileStat.size;
  const range = req.headers.get("range");

  if (!range) {
    const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": source.mimeType || "video/mp4",
        "Content-Length": String(total),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }

  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) return badRange(total);

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : total - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= total
  ) {
    return badRange(total);
  }

  const safeEnd = Math.min(end, total - 1);
  const chunkSize = safeEnd - start + 1;
  const stream = Readable.toWeb(createReadStream(path, { start, end: safeEnd })) as ReadableStream;

  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": source.mimeType || "video/mp4",
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${safeEnd}/${total}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}
