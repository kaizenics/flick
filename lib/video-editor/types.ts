export type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
};

export type VideoSource = {
  id: string;
  kind: "upload" | "url";
  originalName: string;
  mimeType: string;
  sourceUrl: string | null;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  metadata: VideoMetadata;
};

import type { Segment } from "@/lib/video-editor/segments";

export type { Segment };

// Kept ranges of the source, in source time and play order. Gaps between them are cut.
export type EditTimeline = {
  segments: Segment[];
};

export type BlurFilter = {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  startTime: number;
  endTime: number;
  strength: number;
};

export type RenderResult = {
  id: string;
  projectId: string;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  metadata: VideoMetadata;
};

export type VideoEditorProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string | null;
  timeline: EditTimeline | null;
  blur: BlurFilter;
  lastRenderId: string | null;
};

export type VideoEditorProjectWithRefs = VideoEditorProject & {
  source: VideoSource | null;
  lastRender: RenderResult | null;
};

export type VideoEditorProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string | null;
  sourceName: string | null;
  sourceDuration: number | null;
  lastRenderId: string | null;
};
