import {
  attachSourceToProject,
  getProjectByIdWithRefs,
  getSourceById,
  updateProjectById,
} from "@/lib/video-editor/store";
import { validateBlur, validateTimeline } from "@/lib/video-editor/processing";
import type { BlurFilter, EditTimeline } from "@/lib/video-editor/types";

export const runtime = "nodejs";

type PatchBody = {
  name?: string;
  sourceId?: string | null;
  timeline?: EditTimeline | null;
  blur?: BlurFilter;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseTimeline(input: unknown): EditTimeline | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const trimStart = toNumber(raw.trimStart);
  const trimEnd = toNumber(raw.trimEnd);
  const cutStart = raw.cutStart == null ? null : toNumber(raw.cutStart);
  const cutEnd = raw.cutEnd == null ? null : toNumber(raw.cutEnd);
  if (trimStart == null || trimEnd == null) return null;
  return { trimStart, trimEnd, cutStart, cutEnd };
}

function parseBlur(input: unknown): BlurFilter | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const enabled = Boolean(raw.enabled);
  const x = toNumber(raw.x);
  const y = toNumber(raw.y);
  const width = toNumber(raw.width);
  const height = toNumber(raw.height);
  const startTime = toNumber(raw.startTime);
  const endTime = toNumber(raw.endTime);
  const strength = toNumber(raw.strength);
  if (
    x == null ||
    y == null ||
    width == null ||
    height == null ||
    startTime == null ||
    endTime == null ||
    strength == null
  ) {
    return null;
  }

  return {
    enabled,
    x,
    y,
    width,
    height,
    startTime,
    endTime,
    strength,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProjectByIdWithRefs(id);
  if (!project) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json({ project });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const existing = await getProjectByIdWithRefs(id);
  if (!existing) return Response.json({ error: "not-found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;

  let current = existing;
  if (body.sourceId !== undefined) {
    if (body.sourceId === null) {
      const updated = await updateProjectById(id, {
        sourceId: null,
        timeline: null,
        lastRenderId: null,
      });
      if (!updated) return Response.json({ error: "not-found" }, { status: 404 });
      current = (await getProjectByIdWithRefs(id)) ?? current;
    } else {
      const source = await getSourceById(body.sourceId);
      if (!source) {
        return Response.json({ error: "source-not-found" }, { status: 404 });
      }
      const attached = await attachSourceToProject(id, source.id);
      if (!attached) return Response.json({ error: "not-found" }, { status: 404 });
      current = (await getProjectByIdWithRefs(id)) ?? current;
    }
  }

  const patch: PatchBody = {};
  if (typeof body.name === "string") patch.name = body.name;

  const timeline = body.timeline === null ? null : parseTimeline(body.timeline);
  const blur = parseBlur(body.blur);

  if (body.timeline !== undefined && body.timeline !== null && !timeline) {
    return Response.json({ error: "invalid-timeline" }, { status: 400 });
  }
  if (body.blur !== undefined && !blur) {
    return Response.json({ error: "invalid-blur" }, { status: 400 });
  }

  if ((timeline || blur || body.timeline === null) && !current.source) {
    return Response.json({ error: "source-required" }, { status: 400 });
  }

  if (current.source) {
    const nextTimeline =
      body.timeline !== undefined
        ? timeline
        : current.timeline;

    if (!nextTimeline) {
      return Response.json({ error: "timeline-required" }, { status: 400 });
    }

    try {
      validateTimeline(nextTimeline, current.source.metadata.duration);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid timeline";
      return Response.json({ error: message }, { status: 400 });
    }

    if (body.timeline !== undefined) patch.timeline = nextTimeline;

    if (blur || body.blur !== undefined) {
      const nextBlur = blur ?? current.blur;
      try {
        const edit = validateTimeline(nextTimeline, current.source.metadata.duration);
        validateBlur(nextBlur, current.source.metadata, edit);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid blur";
        return Response.json({ error: message }, { status: 400 });
      }
      patch.blur = nextBlur;
    }
  }

  const updated = await updateProjectById(id, patch);
  if (!updated) return Response.json({ error: "not-found" }, { status: 404 });

  const full = await getProjectByIdWithRefs(id);
  return Response.json({ project: full });
}
