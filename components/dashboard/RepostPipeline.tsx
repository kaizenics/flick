"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageStatus = "idle" | "active" | "done" | "error";

export type PipelineStage = {
  id: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
  status: StageStatus;
  /** e.g. "2/3"; shown only when a run has touched the stage. */
  progress?: string;
};

type StageNode = Node<{ stage: PipelineStage }, "stage">;

function StageCard({ data }: NodeProps<StageNode>) {
  const { stage } = data;
  return (
    <div
      className={cn(
        "flex w-[176px] flex-col gap-3 rounded-2xl border bg-card p-3.5 transition-colors",
        stage.status === "active" && "border-white",
        stage.status === "done" && "border-data/60",
        stage.status === "error" && "border-danger-ink",
        stage.status === "idle" && "border-raised",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-0 !bg-raised"
        isConnectable={false}
      />
      <div className="flex items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-lg bg-black text-white">
          {stage.icon}
        </span>
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full",
            stage.status === "done" && "bg-data text-black",
            stage.status === "error" && "bg-danger-tint text-danger-ink",
            stage.status === "active" && "text-white",
          )}
          aria-label={stage.status}
        >
          {stage.status === "done" && <Check className="size-3" strokeWidth={3} />}
          {stage.status === "error" && <X className="size-3" strokeWidth={3} />}
          {stage.status === "active" && <Loader2 className="size-4 animate-spin" />}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2 text-sm font-medium text-white">
          {stage.label}
          {stage.progress && (
            <span className="num text-xs font-normal text-muted-foreground">{stage.progress}</span>
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">{stage.detail}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border-0 !bg-raised"
        isConnectable={false}
      />
    </div>
  );
}

const nodeTypes = { stage: StageCard };

// Read-only React Flow canvas of the repost pipeline. Each stage lights up as
// the schedule stream reports items entering it.
export function RepostPipeline({ stages }: { stages: PipelineStage[] }) {

  const nodes = useMemo<StageNode[]>(
    () =>
      stages.map((stage, i) => ({
        id: stage.id,
        type: "stage",
        position: { x: i * 220, y: 0 },
        data: { stage },
        draggable: false,
        selectable: false,
      })),
    [stages],
  );

  const edges = useMemo<Edge[]>(
    () =>
      stages.slice(1).map((stage, i) => {
        const from = stages[i];
        const flowing = stage.status === "active";
        const passed = from.status === "done";
        return {
          id: `${from.id}-${stage.id}`,
          source: from.id,
          target: stage.id,
          type: "smoothstep",
          animated: flowing,
          style: {
            stroke: passed || flowing ? "var(--data)" : "#3a3a3a",
            strokeWidth: 2,
          },
        };
      }),
    [stages],
  );

  return (
    // Phones scroll the strip sideways at native size instead of shrinking it.
    <div className="w-full min-w-0 overflow-x-auto rounded-[20px] border border-border bg-black">
      <div
        className="h-[160px] min-w-[960px]"
        role="img"
        aria-label={stages.map((s) => `${s.label}: ${s.status}`).join(", ")}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.06, maxZoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
          style={{ background: "transparent" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#262626" />
        </ReactFlow>
      </div>
    </div>
  );
}
