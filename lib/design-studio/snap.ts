import type { Canvas, FabricObject } from "fabric";

export type Guide = { axis: "x" | "y"; at: number };

const SNAP_PX = 6;

// Finds the smallest shift (within threshold) that lines one of `edges` up with one of `lines`.
export function nearestSnap(edges: number[], lines: number[], threshold: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const line of lines) {
    for (const edge of edges) {
      const delta = line - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: line };
    }
  }
  return best;
}

// Snaps the moving object to page edges/centre and to other objects' edges/centres. Returns guides to draw.
export function snapMoving(c: Canvas, target: FabricObject, pageW: number, pageH: number): Guide[] {
  const threshold = SNAP_PX / c.getZoom();
  const skip = new Set<FabricObject>([target, ...c.getActiveObjects()]);
  const xs = [0, pageW / 2, pageW];
  const ys = [0, pageH / 2, pageH];
  for (const o of c.getObjects()) {
    if (skip.has(o) || !o.visible) continue;
    const r = o.getBoundingRect();
    xs.push(r.left, r.left + r.width / 2, r.left + r.width);
    ys.push(r.top, r.top + r.height / 2, r.top + r.height);
  }
  const r = target.getBoundingRect();
  const sx = nearestSnap([r.left, r.left + r.width / 2, r.left + r.width], xs, threshold);
  const sy = nearestSnap([r.top, r.top + r.height / 2, r.top + r.height], ys, threshold);
  if (sx) target.set({ left: target.left + sx.delta });
  if (sy) target.set({ top: target.top + sy.delta });
  if (sx || sy) target.setCoords();
  const guides: Guide[] = [];
  if (sx) guides.push({ axis: "x", at: sx.at });
  if (sy) guides.push({ axis: "y", at: sy.at });
  return guides;
}

export function drawGuides(ctx: CanvasRenderingContext2D, c: Canvas, guides: Guide[], pageW: number, pageH: number): void {
  if (!guides.length) return;
  const z = c.getZoom();
  ctx.save();
  ctx.strokeStyle = "#ec4899";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const g of guides) {
    if (g.axis === "x") {
      ctx.moveTo(g.at * z + 0.5, 0);
      ctx.lineTo(g.at * z + 0.5, pageH * z);
    } else {
      ctx.moveTo(0, g.at * z + 0.5);
      ctx.lineTo(pageW * z, g.at * z + 0.5);
    }
  }
  ctx.stroke();
  ctx.restore();
}
