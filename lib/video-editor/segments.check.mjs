// Self-check for legacy trim/cut -> segments conversion. Run: node lib/video-editor/segments.check.mjs
import assert from "node:assert/strict";
import { coerceSegments, segmentsFromLegacy, validateSegments } from "./segments.ts";

assert.deepEqual(segmentsFromLegacy({ trimStart: 1, trimEnd: 9, cutStart: null, cutEnd: null }), [{ start: 1, end: 9 }]);
assert.deepEqual(segmentsFromLegacy({ trimStart: 0, trimEnd: 10, cutStart: 3, cutEnd: 5 }), [
  { start: 0, end: 3 },
  { start: 5, end: 10 },
]);
// cut touching the trim edge leaves no empty segment
assert.deepEqual(segmentsFromLegacy({ trimStart: 2, trimEnd: 10, cutStart: 2, cutEnd: 4 }), [{ start: 4, end: 10 }]);
assert.deepEqual(coerceSegments({ trimStart: "0", trimEnd: 10, cutStart: 3, cutEnd: 5 }), [
  { start: 0, end: 3 },
  { start: 5, end: 10 },
]);
assert.deepEqual(coerceSegments({ segments: [{ start: 1, end: 2 }] }), [{ start: 1, end: 2 }]);
assert.equal(coerceSegments({ segments: [{ start: "x", end: 2 }] }), null);
assert.throws(() => validateSegments([{ start: 3, end: 5 }, { start: 4, end: 6 }], 10), /overlaps/);
assert.throws(() => validateSegments([{ start: 0, end: 11 }], 10), /outside/);
assert.throws(() => validateSegments([], 10), /at least one/);
console.log("segments self-check ok");
