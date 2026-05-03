import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { accountDir } from "./accounts-store";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

export type YoutubeOauthState = {
  refreshToken: string;
  channelId?: string;
  channelTitle?: string;
  connectedAt: string;
};

function stateFile(accountId: string): string {
  return join(accountDir(accountId), "youtube-oauth.json");
}

export function getOauthEnv(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.YT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "YT_OAUTH_CLIENT_ID / YT_OAUTH_CLIENT_SECRET not configured — see SETUP.md",
    );
  }
  const explicit = process.env.YT_OAUTH_REDIRECT_URI;
  const base = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  const redirectUri = explicit ?? `${base ?? "http://localhost:3000"}/api/reposting/oauth/youtube/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(stateValue: string): string {
  const { clientId, redirectUri } = getOauthEnv();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", stateValue);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const { clientId, clientSecret, redirectUri } = getOauthEnv();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getOauthEnv();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function fetchChannelInfo(
  accessToken: string,
): Promise<{ id?: string; title?: string }> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    items?: Array<{ id: string; snippet?: { title?: string } }>;
  };
  const item = data.items?.[0];
  return { id: item?.id, title: item?.snippet?.title };
}

export async function readState(accountId: string): Promise<YoutubeOauthState | null> {
  try {
    const text = await readFile(stateFile(accountId), "utf8");
    return JSON.parse(text) as YoutubeOauthState;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function saveStateFromCode(
  accountId: string,
  code: string,
): Promise<YoutubeOauthState> {
  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token returned. Revoke previous access and try again with prompt=consent.",
    );
  }
  const channel = await fetchChannelInfo(tokens.access_token).catch(
    () => ({} as { id?: string; title?: string }),
  );
  const state: YoutubeOauthState = {
    refreshToken: tokens.refresh_token,
    channelId: channel.id,
    channelTitle: channel.title,
    connectedAt: new Date().toISOString(),
  };
  const file = stateFile(accountId);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  return state;
}

export async function disconnect(accountId: string): Promise<void> {
  await rm(stateFile(accountId), { force: true });
}
