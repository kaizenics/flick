// Self-check for design-studio pure helpers. Run: node lib/design-studio/design.check.mjs
import assert from "node:assert/strict";
import { cropFromLocalBox } from "./crop.ts";
import { pagesFromDoc } from "./doc.ts";
import { nearestSnap } from "./snap.ts";

const img = { cropX: 0, cropY: 0, width: 200, height: 100 };
// right half of the image
assert.deepEqual(cropFromLocalBox(img, { minX: 0, maxX: 100, minY: -50, maxY: 50 }), {
  cropX: 100, cropY: 0, width: 100, height: 100, cx: 50, cy: 0,
});
// box larger than the image is clamped; reversed corners are fine
assert.deepEqual(cropFromLocalBox(img, { minX: 150, maxX: -150, minY: -80, maxY: 80 }), {
  cropX: 0, cropY: 0, width: 200, height: 100, cx: 0, cy: 0,
});
// cropping an already-cropped image offsets from the existing crop
assert.equal(cropFromLocalBox({ cropX: 40, cropY: 10, width: 100, height: 50 }, { minX: -50, maxX: 0, minY: -25, maxY: 25 }).cropX, 40);

assert.deepEqual(pagesFromDoc(null), []);
assert.deepEqual(pagesFromDoc({ objects: [], background: "#fff" }), [{ objects: [], background: "#fff" }]);
assert.deepEqual(pagesFromDoc({ pages: [{ objects: [] }, null] }), [{ objects: [] }]);

assert.deepEqual(nearestSnap([10, 50, 90], [0, 54, 100], 6), { delta: 4, at: 54 });
assert.equal(nearestSnap([10], [30], 6), null);

console.log("design-studio checks passed");
