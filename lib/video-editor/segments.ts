// Pure timeline helpers, no imports, so segments.check.mjs can run them under plain node.

export type Segment = { start: number; end: number };

export type LegacyEditTimeline = {
  trimStart: number;
  trimEnd: number;
  cutStart: number | null;
  cutEnd: number | null;
};

export const MAX_SEGMENTS = 500;
const EPS = 0.001;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Old projects stored a trim range plus one optional middle cut.
export function segmentsFromLegacy(t: LegacyEditTimeline): Segment[] {
  if (t.cutStart == null || t.cutEnd == null) return [{ start: t.trimStart, end: t.trimEnd }];
  return [
    { start: t.trimStart, end: t.cutStart },
    { start: t.cutEnd, end: t.trimEnd },
  ].filter((s) => s.end - s.start > 0);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Accepts the current `{ segments }` shape or the legacy trim/cut shape. Returns null when unreadable.
export function coerceSegments(raw: unknown): Segment[] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.segments)) {
    const out: Segment[] = [];
    for (const item of r.segments) {
      if (!item || typeof item !== "object") return null;
      const start = num((item as Record<string, unknown>).start);
      const end = num((item as Record<string, unknown>).end);
      if (start == null || end == null) return null;
      out.push({ start, end });
    }
    return out;
  }
  const trimStart = num(r.trimStart);
  const trimEnd = num(r.trimEnd);
  if (trimStart == null || trimEnd == null) return null;
  const cutStart = r.cutStart == null ? null : num(r.cutStart);
  const cutEnd = r.cutEnd == null ? null : num(r.cutEnd);
  return segmentsFromLegacy({ trimStart, trimEnd, cutStart, cutEnd });
}

// Throws on anything a render could not honour: empty, out of range, unsorted or overlapping.
export function validateSegments(segments: Segment[], duration: number): Segment[] {
  if (segments.length === 0) throw new Error("Timeline needs at least one segment");
  if (segments.length > MAX_SEGMENTS) throw new Error("Too many segments");
  let prevEnd = 0;
  return segments.map((s, i) => {
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end)) throw new Error(`Segment ${i + 1} is not a number`);
    if (s.start < -EPS || s.end > duration + EPS) throw new Error(`Segment ${i + 1} is outside the clip`);
    if (!(s.end - s.start > EPS)) throw new Error(`Segment ${i + 1} has no length`);
    if (s.start < prevEnd - EPS) throw new Error(`Segment ${i + 1} overlaps the previous one or is out of order`);
    prevEnd = s.end;
    return { start: round3(Math.max(0, s.start)), end: round3(Math.min(duration, s.end)) };
  });
}

export function segmentsDuration(segments: Segment[]): number {
  return round3(segments.reduce((sum, s) => sum + (s.end - s.start), 0));
}
