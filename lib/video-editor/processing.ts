import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BlurFilter, EditTimeline, Segment, VideoMetadata } from "@/lib/video-editor/types";
import { segmentsDuration, validateSegments } from "@/lib/video-editor/segments";

function runCommand(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${bin} exited ${code}: ${stderr || stdout}`));
    });
  });
}

function parseFps(rate: string | undefined): number {
  if (!rate || rate === "0/0") return 0;
  const [aRaw, bRaw] = rate.split("/");
  const a = Number(aRaw);
  const b = Number(bRaw);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return a / b;
}

export async function probeVideo(path: string): Promise<VideoMetadata> {
  const output = await runCommand("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    path,
  ]);

  const parsed = JSON.parse(output) as {
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      codec_name?: string;
      avg_frame_rate?: string;
      r_frame_rate?: string;
      duration?: string;
    }>;
    format?: { duration?: string };
  };

  const streams = parsed.streams ?? [];
  const videoStream = streams.find((s) => s.codec_type === "video");
  const audioStream = streams.find((s) => s.codec_type === "audio");
  if (!videoStream) throw new Error("No video stream found");

  const fps =
    parseFps(videoStream.avg_frame_rate) ||
    parseFps(videoStream.r_frame_rate) ||
    30;
  const duration =
    Number(parsed.format?.duration) || Number(videoStream.duration) || 0;
  if (!(duration > 0)) throw new Error("Failed to read video duration");

  return {
    duration,
    width: Number(videoStream.width) || 0,
    height: Number(videoStream.height) || 0,
    fps,
    hasAudio: Boolean(audioStream),
    videoCodec: videoStream.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function asFilterNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

type NormalizedEdit = {
  segments: Segment[];
  outputDuration: number;
};

export function validateTimeline(
  timeline: EditTimeline,
  duration: number,
): NormalizedEdit {
  const segments = validateSegments(timeline.segments, duration);
  return { segments, outputDuration: segmentsDuration(segments) };
}

function intersects(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

function blurIntervalsInOutput(
  edit: NormalizedEdit,
  blurStart: number,
  blurEnd: number,
): Array<{ start: number; end: number }> {
  const intervals: Array<{ start: number; end: number }> = [];
  let offset = 0;
  for (const seg of edit.segments) {
    if (intersects(blurStart, blurEnd, seg.start, seg.end)) {
      const s = offset + (clamp(blurStart, seg.start, seg.end) - seg.start);
      const e = offset + (clamp(blurEnd, seg.start, seg.end) - seg.start);
      if (e > s) intervals.push({ start: round3(s), end: round3(e) });
    }
    offset += seg.end - seg.start;
  }
  return intervals;
}

export function validateBlur(
  blur: BlurFilter,
  meta: VideoMetadata,
  edit: NormalizedEdit,
): { enabled: false } | { enabled: true; intervals: Array<{ start: number; end: number }>; blur: BlurFilter } {
  if (!blur.enabled) return { enabled: false };

  const x = Math.round(blur.x);
  const y = Math.round(blur.y);
  const width = Math.round(blur.width);
  const height = Math.round(blur.height);
  const strength = Math.round(blur.strength);
  const startTime = round3(blur.startTime);
  const endTime = round3(blur.endTime);

  if (width <= 0 || height <= 0) throw new Error("Blur box size must be positive");
  if (x < 0 || y < 0) throw new Error("Blur box coordinates must be non-negative");
  if (x + width > meta.width || y + height > meta.height) {
    throw new Error("Blur box is outside frame bounds");
  }
  if (!(startTime >= 0 && endTime > startTime && endTime <= meta.duration)) {
    throw new Error("Blur time range is invalid");
  }

  const intervals = blurIntervalsInOutput(edit, startTime, endTime);
  if (intervals.length === 0) {
    throw new Error("Blur range does not apply to exported timeline");
  }

  return {
    enabled: true,
    intervals,
    blur: {
      ...blur,
      x,
      y,
      width,
      height,
      strength: clamp(strength, 1, 30),
      startTime,
      endTime,
    },
  };
}

function buildEnableExpression(intervals: Array<{ start: number; end: number }>): string {
  if (intervals.length === 1) {
    return `between(t,${asFilterNumber(intervals[0].start)},${asFilterNumber(intervals[0].end)})`;
  }
  return intervals
    .map((item) => `between(t,${asFilterNumber(item.start)},${asFilterNumber(item.end)})`)
    .join("+");
}

function buildFilterGraph(params: {
  edit: NormalizedEdit;
  blur: ReturnType<typeof validateBlur>;
  hasAudio: boolean;
}): { graph: string; videoOutLabel: string; audioOutLabel: string | null } {
  const chains: string[] = [];
  const { edit, blur, hasAudio } = params;

  let videoLabel = "vwork";
  const audioLabel: string | null = hasAudio ? "awork" : null;

  const n = edit.segments.length;
  edit.segments.forEach((seg, i) => {
    const range = `start=${asFilterNumber(seg.start)}:end=${asFilterNumber(seg.end)}`;
    chains.push(`[0:v]trim=${range},setpts=PTS-STARTPTS[${n === 1 ? videoLabel : `v${i}`}]`);
    if (audioLabel) chains.push(`[0:a]atrim=${range},asetpts=PTS-STARTPTS[${n === 1 ? audioLabel : `a${i}`}]`);
  });
  if (n > 1) {
    const vIns = edit.segments.map((_, i) => `[v${i}]`).join("");
    chains.push(`${vIns}concat=n=${n}:v=1:a=0[${videoLabel}]`);
    if (audioLabel) {
      const aIns = edit.segments.map((_, i) => `[a${i}]`).join("");
      chains.push(`${aIns}concat=n=${n}:v=0:a=1[${audioLabel}]`);
    }
  }

  if (blur.enabled) {
    const blurOut = "vblurred";
    const patch = "vpatch";
    const strength = clamp(Math.round(blur.blur.strength), 1, 30);
    const enableExpr = buildEnableExpression(blur.intervals);
    chains.push(
      `[${videoLabel}]split=2[vmain][vtmp]`,
      `[vtmp]crop=${Math.round(blur.blur.width)}:${Math.round(blur.blur.height)}:${Math.round(blur.blur.x)}:${Math.round(blur.blur.y)},boxblur=luma_radius=${strength}:luma_power=1[${patch}]`,
      `[vmain][${patch}]overlay=${Math.round(blur.blur.x)}:${Math.round(blur.blur.y)}:enable='${enableExpr}'[${blurOut}]`,
    );
    videoLabel = blurOut;
  }

  return {
    graph: chains.join(";"),
    videoOutLabel: videoLabel,
    audioOutLabel: audioLabel,
  };
}

export async function renderVideo(params: {
  inputPath: string;
  timeline: EditTimeline;
  blur: BlurFilter;
  sourceMeta: VideoMetadata;
}): Promise<{ outputPath: string; outputDuration: number }> {
  const edit = validateTimeline(params.timeline, params.sourceMeta.duration);
  const blur = validateBlur(params.blur, params.sourceMeta, edit);
  const tempOut = join(
    tmpdir(),
    `video-editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`,
  );

  const { graph, videoOutLabel, audioOutLabel } = buildFilterGraph({
    edit,
    blur,
    hasAudio: params.sourceMeta.hasAudio,
  });

  const args = [
    "-y",
    "-i",
    params.inputPath,
    "-filter_complex",
    graph,
    "-map",
    `[${videoOutLabel}]`,
  ];

  if (audioOutLabel) {
    args.push("-map", `[${audioOutLabel}]`, "-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-an");
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    tempOut,
  );

  await runCommand("ffmpeg", args);
  return { outputPath: tempOut, outputDuration: edit.outputDuration };
}
