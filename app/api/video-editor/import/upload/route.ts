import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSourceFromBuffer } from "@/lib/video-editor/store";
import { probeVideo } from "@/lib/video-editor/processing";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }

  if (file.size <= 0) {
    return Response.json({ error: "empty file" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "file too large (max 500MB)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const tempPath = join(
    tmpdir(),
    `video-editor-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`,
  );

  try {
    await writeFile(tempPath, bytes);
    const metadata = await probeVideo(tempPath);
    const source = await createSourceFromBuffer({
      kind: "upload",
      originalName: file.name || "upload.mp4",
      mimeType: file.type || "video/mp4",
      data: bytes,
      metadata,
    });
    return Response.json({ source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload import failed";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}
