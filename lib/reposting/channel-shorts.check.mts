// Run: npx tsx lib/reposting/channel-shorts.check.mts — channel link parsing.
import assert from "node:assert";
const { channelShortsUrl }: typeof import("./channel-shorts") = await import(
  new URL("./channel-shorts.ts", import.meta.url).href
);

const ok: Array<[string, string]> = [
  ["https://www.youtube.com/@pinoy_shinobi", "https://www.youtube.com/@pinoy_shinobi/shorts"],
  ["youtube.com/@pinoy_shinobi/videos", "https://www.youtube.com/@pinoy_shinobi/shorts"],
  ["@pinoy_shinobi", "https://www.youtube.com/@pinoy_shinobi/shorts"],
  ["https://m.youtube.com/@a.b-c?si=x", "https://www.youtube.com/@a.b-c/shorts"],
  [
    "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
    "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/shorts",
  ],
  ["https://www.youtube.com/c/SomeName", "https://www.youtube.com/c/SomeName/shorts"],
];
for (const [input, want] of ok) assert.equal(channelShortsUrl(input), want, input);

const bad = [
  "https://www.youtube.com/shorts/d65WF3YmBYg",
  "https://www.youtube.com/watch?v=d65WF3YmBYg",
  "https://evil.com/@pinoy_shinobi",
  "--exec rm",
  "@bad handle",
  "",
];
for (const input of bad) assert.equal(channelShortsUrl(input), null, input);
console.log("channel-shorts check ok");
