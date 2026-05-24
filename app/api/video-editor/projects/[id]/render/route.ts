import { rm } from "node:fs/promises";
import {
  createRenderResult,
  getProjectByIdWithRefs,
  updateProjectById,
  sourcePathFor,
} from "@/lib/video-editor/store";
import { probeVideo, renderVideo } from "@/lib/video-editor/processing";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProjectByIdWithRefs(id);
  if (!project) return Response.json({ error: "not-found" }, { status: 404 });
  if (!project.source) {
    return Response.json({ error: "source-required" }, { status: 400 });
  }
  if (!project.timeline) {
    return Response.json({ error: "timeline-required" }, { status: 400 });
  }

  let tempOutput: string | null = null;

  try {
    const sourcePath = sourcePathFor(project.source);
    const rendered = await renderVideo({
      inputPath: sourcePath,
      sourceMeta: project.source.metadata,
      timeline: project.timeline,
      blur: project.blur,
    });
    tempOutput = rendered.outputPath;
    const outputMeta = await probeVideo(tempOutput);
    const result = await createRenderResult({
      projectId: project.id,
      outputPath: tempOutput,
      metadata: outputMeta,
    });
    tempOutput = null;

    await updateProjectById(project.id, { lastRenderId: result.id });

    return Response.json({
      render: {
        ...result,
        downloadUrl: `/api/video-editor/exports/${result.id}/file`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "render failed";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    if (tempOutput) await rm(tempOutput, { force: true }).catch(() => {});
  }
}
