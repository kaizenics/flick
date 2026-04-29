import type { Page } from "playwright";
import { followButton, alreadyFollowing } from "./selectors";
import { randomDelay } from "./browser";

export type FollowResult =
  | { status: "followed" }
  | { status: "already-following" }
  | { status: "not-supported"; reason: string };

/**
 * Visit a target Page URL and try to click Follow.
 *
 * The caller is expected to have already switched the browser identity
 * to the source Page. If the current FB UI does not expose a page-to-page
 * Follow button (it's not always allowed), this returns "not-supported"
 * rather than throwing — we never simulate something the user cannot do
 * manually in the same UI.
 */
export async function followPage(page: Page, targetUrl: string): Promise<FollowResult> {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await randomDelay(1200, 2800);

  if (await alreadyFollowing(page)) {
    return { status: "already-following" };
  }

  const btn = await followButton(page);
  if (!btn) {
    return {
      status: "not-supported",
      reason: "No Follow button visible (FB may not allow page-to-page follow here)",
    };
  }

  await btn.scrollIntoViewIfNeeded();
  await randomDelay(300, 900);
  await btn.click();
  await randomDelay(1500, 3000);

  // Confirm by re-checking state.
  if (await alreadyFollowing(page)) return { status: "followed" };

  // Click registered but state didn't flip — treat as not-supported rather
  // than asserting success.
  return {
    status: "not-supported",
    reason: "Click did not transition to Following state",
  };
}
