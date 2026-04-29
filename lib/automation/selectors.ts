import type { Page, Locator } from "playwright";

/**
 * Resilient selectors for Facebook UI elements.
 *
 * Strategy: try each candidate locator in order. Each is given a short
 * timeout so a missing UI doesn't block the whole flow. Facebook ships
 * many DOM variants — we prefer role+name (accessible) selectors over
 * brittle CSS class chains.
 */

type Candidate = (page: Page) => Locator;

async function firstVisible(
  page: Page,
  candidates: Candidate[],
  perTryTimeoutMs = 2500,
): Promise<Locator | null> {
  for (const make of candidates) {
    const loc = make(page).first();
    try {
      await loc.waitFor({ state: "visible", timeout: perTryTimeoutMs });
      return loc;
    } catch {
      // try the next one
    }
  }
  return null;
}

/** Top-right account switcher avatar / "Your profile" menu opener. */
export function accountSwitcherTrigger(page: Page) {
  return firstVisible(page, [
    (p) => p.getByRole("button", { name: /your profile|account/i }),
    (p) => p.locator('[aria-label*="Your profile" i]'),
    (p) => p.locator('[aria-label*="Account" i]'),
  ]);
}

/** "See all profiles" / "See all Pages" entry inside the account menu. */
export function seeAllProfiles(page: Page) {
  return firstVisible(page, [
    (p) => p.getByRole("button", { name: /see all (profiles|pages)/i }),
    (p) => p.getByRole("link", { name: /see all (profiles|pages)/i }),
    (p) => p.getByText(/see all (profiles|pages)/i),
    (p) => p.getByRole("menuitem", { name: /switch profile/i }),
  ]);
}

/** Click a specific profile/page tile by its visible name. */
export function profileTileByName(page: Page, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}$`, "i");
  return firstVisible(page, [
    (p) => p.getByRole("link", { name: re }),
    (p) => p.getByRole("button", { name: re }),
    (p) => p.getByText(re),
  ]);
}

/** A "Follow" button on a Page. Returns null if not present (already
 *  following, or FB does not allow page-to-page follow in this UI). */
export function followButton(page: Page) {
  return firstVisible(page, [
    (p) => p.getByRole("button", { name: /^follow$/i }),
    (p) => p.locator('div[role="button"][aria-label="Follow" i]'),
    (p) => p.locator('[aria-label="Follow" i]'),
  ]);
}

/** Indicator that we're already following (so we should skip). */
export function alreadyFollowing(page: Page) {
  return firstVisible(
    page,
    [
      (p) => p.getByRole("button", { name: /^following$/i }),
      (p) => p.locator('[aria-label="Following" i]'),
    ],
    1500,
  );
}

/** A "Like" button on a Page (fallback when Follow isn't exposed). */
export function likeButton(page: Page) {
  return firstVisible(page, [
    (p) => p.getByRole("button", { name: /^like$/i }),
    (p) => p.locator('div[role="button"][aria-label="Like" i]'),
    (p) => p.locator('[aria-label="Like" i]'),
  ]);
}

/** Already-liked indicator. */
export function alreadyLiked(page: Page) {
  return firstVisible(
    page,
    [
      (p) => p.getByRole("button", { name: /^liked$/i }),
      (p) => p.locator('[aria-label="Liked" i]'),
    ],
    1500,
  );
}
