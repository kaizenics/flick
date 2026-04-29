import type { Page } from "playwright";
import {
  followButton,
  alreadyFollowing,
  likeButton,
  alreadyLiked,
} from "./selectors";
import { randomDelay } from "./browser";

export type FollowResult =
  | { status: "followed" }
  | { status: "liked" }
  | { status: "already-following" }
  | { status: "already-liked" }
  | { status: "not-supported"; reason: string };

/**
 * Visit a target Page URL and try to click Follow. If the Follow button
 * is not exposed (FB doesn't always allow page-to-page follow), fall
 * back to Like. Returns a status describing what happened.
 */
export async function followPage(page: Page, targetUrl: string): Promise<FollowResult> {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await randomDelay(1200, 2800);

  // Already-following short-circuit.
  if (await alreadyFollowing(page)) return { status: "already-following" };

  // Try Follow first.
  const fBtn = await followButton(page);
  if (fBtn) {
    await fBtn.scrollIntoViewIfNeeded();
    await randomDelay(300, 900);
    await fBtn.click();
    await randomDelay(1500, 3000);
    if (await alreadyFollowing(page)) return { status: "followed" };
    // Click registered but state didn't flip — fall through to Like.
  }

  // Fallback: Like.
  if (await alreadyLiked(page)) return { status: "already-liked" };

  const lBtn = await likeButton(page);
  if (!lBtn) {
    return {
      status: "not-supported",
      reason: "Neither Follow nor Like button visible",
    };
  }

  await lBtn.scrollIntoViewIfNeeded();
  await randomDelay(300, 900);
  await lBtn.click();
  await randomDelay(1500, 3000);

  if (await alreadyLiked(page)) return { status: "liked" };

  return {
    status: "not-supported",
    reason: "Like click did not transition to Liked state",
  };
}
