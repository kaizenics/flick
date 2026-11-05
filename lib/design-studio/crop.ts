export type Crop = { cropX: number; cropY: number; width: number; height: number };

// Turns a crop box, given in the image's local plane (origin at its centre), into Fabric crop props
// plus the new centre in that same local plane. The box is clamped to the visible image.
export function cropFromLocalBox(
  cur: Crop,
  box: { minX: number; maxX: number; minY: number; maxY: number },
): Crop & { cx: number; cy: number } {
  const hw = cur.width / 2;
  const hh = cur.height / 2;
  const minX = Math.max(-hw, Math.min(box.minX, box.maxX));
  const maxX = Math.min(hw, Math.max(box.minX, box.maxX));
  const minY = Math.max(-hh, Math.min(box.minY, box.maxY));
  const maxY = Math.min(hh, Math.max(box.minY, box.maxY));
  return {
    cropX: cur.cropX + minX + hw,
    cropY: cur.cropY + minY + hh,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}
