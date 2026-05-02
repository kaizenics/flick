import type { Page } from "playwright";
import { randomDelay } from "./browser";
import type { ReactionKind } from "../store";

export type ReactionResult =
  | { status: "reacted" }
  | { status: "already-reacted" }
  | { status: "not-supported"; reason: string };

const REACTION_LABELS: Record<ReactionKind, string[]> = {
  like: ["Like"],
  love: ["Love"],
  haha: ["Haha"],
  wow: ["Wow"],
  sad: ["Sad"],
  angry: ["Angry"],
};

/**
 * Visit a post permalink and drop the chosen reaction.
 *
 * Strategy: hover the main post's Like button to reveal the reaction tray,
 * then click the matching reaction. Falls back to a plain Like click if we
 * can't summon the tray.
 */
export async function reactToPost(
  page: Page,
  postUrl: string,
  reaction: ReactionKind,
): Promise<ReactionResult> {
  await page.goto(postUrl, { waitUntil: "domcontentloaded" });
  await randomDelay(1500, 3000);

  // Find the main Like button. There may be many on the page (one per
  // post + per-comment); the first visible one in the article container
  // tends to be the post's. We try in priority order.
  const candidates = [
    page.locator('div[role="article"]').first().getByRole("button", { name: /^(Like|React)$/i }).first(),
    page.getByRole("button", { name: /^Like$/ }).first(),
    page.locator('[aria-label="Like"]').first(),
  ];

  let likeBtn = null;
  for (const c of candidates) {
    if (await c.isVisible().catch(() => false)) {
      likeBtn = c;
      break;
    }
  }

  if (!likeBtn) {
    return { status: "not-supported", reason: "Like button not found on post" };
  }

  // For "Like" we just click it directly.
  if (reaction === "like") {
    await likeBtn.scrollIntoViewIfNeeded();
    await randomDelay(300, 700);
    await likeBtn.click();
    await randomDelay(1200, 2200);
    return { status: "reacted" };
  }

  // Otherwise, hover to summon the reactions tray.
  await likeBtn.scrollIntoViewIfNeeded();
  await randomDelay(200, 500);
  await likeBtn.hover();
  await randomDelay(800, 1400);

  const labels = REACTION_LABELS[reaction];
  for (const label of labels) {
    const target = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
    if (await target.isVisible().catch(() => false)) {
      await target.click();
      await randomDelay(1200, 2200);
      return { status: "reacted" };
    }
  }

  // Tray didn't open — fall back to a plain Like as a graceful degradation.
  await likeBtn.click().catch(() => {});
  return { status: "not-supported", reason: `Reaction tray didn't reveal "${reaction}"` };
}
