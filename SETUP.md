# fb-auto — Setup Guide

Walkthrough for getting this project running on a fresh machine, including the
**system-level binaries** that the reposting feature depends on (these are the
"hard blockers" — without them the YouTube → Facebook pipeline fails at runtime).

If you're an AI agent reading this: see the [Agents section](#for-ai-agents)
near the bottom.

---

## What this project does

Two automation features sit in one Next.js app:

1. **Reposting pipeline** (`/reposting`) — given a YouTube Shorts URL, downloads
   the video, has an LLM write a Facebook caption, then uploads to a Facebook
   Page (with optional native FB scheduling).
2. **Browser automation** (`lib/automation/`) — Playwright-driven scripts that
   log into Facebook and perform follow / react actions across multiple Pages.
   Uses the Graph API where possible; falls back to browser automation.

Both features need binaries that don't exist in serverless environments
(Vercel, Cloudflare Workers, Lambda). **Run on a normal Linux/macOS machine or
a VPS — not on Vercel.** See [Deployment](#deployment-vps) for a production
recipe.

---

## Prerequisites

### 1. System binaries (the hard blockers)

| Binary    | Why it's needed                          | Used by                       |
| --------- | ---------------------------------------- | ----------------------------- |
| `yt-dlp`  | Downloads YouTube videos                 | `lib/reposting/download.ts`   |
| `ffmpeg`  | Merges 1080p video + audio streams       | yt-dlp (transparently)        |
| Chromium  | Headless browser for FB automation       | `lib/automation/browser.ts`   |

**Install on Linux / WSL:**

```bash
# ffmpeg from apt is fine
sudo apt update
sudo apt install -y ffmpeg

# yt-dlp: DO NOT use apt — Ubuntu's package is months out of date and YouTube
# breaks it within weeks. Always install the latest binary directly:
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
yt-dlp --version   # verify

# Chromium for Playwright (only needed if using lib/automation/)
# This step happens automatically after `pnpm install` if you run:
pnpm exec playwright install --with-deps chromium
```

**Install on macOS:**

```bash
brew install ffmpeg yt-dlp
pnpm exec playwright install --with-deps chromium
```

**Install on Windows:** use WSL2 with Ubuntu and follow the Linux instructions.
Native Windows works in theory but yt-dlp updates and Playwright dependencies
are messier; WSL2 is what we test against.

**Keeping yt-dlp current:** YouTube changes their player periodically, breaking
download. When `yt-dlp` starts failing with errors like `Precondition check
failed` or `nsig extraction failed`, re-run the curl command above to fetch
the latest release. Plan to do this every 1–2 months.

### 2. Node.js + pnpm

- Node **22 LTS** or newer
- pnpm **9+**

```bash
# nvm-style install (recommended for keeping versions sane)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install --lts
npm install -g pnpm
```

### 3. A Turso (libSQL) database

The app uses Turso for both Better Auth user storage and workflow data.

**Quickest path:**

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up / log in
turso auth signup   # or: turso auth login

# Create a database (free tier is fine)
turso db create fb-auto

# Get the connection URL and an auth token
turso db show fb-auto --url            # → libsql://fb-auto-<your-org>.turso.io
turso db tokens create fb-auto         # → eyJhbGciOi…
```

Save both values — they go into `.env.local`.

**Alternative — local SQLite file (dev only):**

```
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=
```

This works for local development but you lose multi-machine sync and any real
production-readiness.

---

## Project setup

### Clone and install

```bash
git clone <repo-url> fb-auto
cd fb-auto
pnpm install
```

### Configure environment

Copy the example file and fill in real values:

```bash
cp .env.example .env.local
```

Open `.env.local` and provide:

- **`BETTER_AUTH_SECRET`** — generate with `openssl rand -base64 32`
- **`BETTER_AUTH_URL`** — `http://localhost:3000` for dev,
  `https://your-domain.tld` for production
- **`TURSO_DATABASE_URL`** + **`TURSO_AUTH_TOKEN`** — from the Turso step above
- **`GOOGLE_CLIENT_ID`** + **`GOOGLE_CLIENT_SECRET`** — see
  [Google OAuth](#google-oauth-setup)

The reposting-pipeline keys (YouTube, OpenRouter, Facebook) can be left blank
in `.env.local` — they have a UI to manage them at runtime under
`/reposting → Settings`. Setting them in `.env.local` is just a fallback. See
[Reposting credentials](#reposting-credentials).

### Run the database migration

Better Auth needs its tables created in your Turso database:

```bash
pnpm auth:migrate
```

This is a one-shot. Re-run only if you upgrade `better-auth` in the future.

### Start the dev server

```bash
pnpm dev
# → http://localhost:3000
```

Sign in with Google. The first user becomes the admin. Note that
`disableSignUp: true` is set in `lib/auth.ts` — you may need to flip that
temporarily on the very first run, or seed your user row manually.

---

## Google OAuth setup

1. Go to <https://console.cloud.google.com/apis/credentials>.
2. Create OAuth client ID → **Web application**.
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   (and `https://your-domain.tld/api/auth/callback/google` for production).
4. Copy Client ID and Secret into `.env.local`.

---

## Reposting credentials

Three keys are needed — all manageable in the UI under **`/reposting →
Settings`** (stored in `data/reposting-config.json`, gitignored, mode 0600).

### YouTube Data API v3

1. <https://console.cloud.google.com/> → enable **YouTube Data API v3** for
   your project.
2. Credentials → Create Credentials → API key.
3. Restrict the key to *YouTube Data API v3* under API restrictions.
   Application restriction can stay **None** — this is a server-side key.

Free tier: 10,000 units/day. Each pipeline run uses ~1 unit (video metadata).

### OpenRouter (LLM caption writer)

1. <https://openrouter.ai/keys> → create key.
2. Add credits at <https://openrouter.ai/credits> (paid; even Haiku is not
   free).
3. Model selection happens in the UI; default is `anthropic/claude-haiku-4.5`.

If the key is missing the pipeline silently falls back to using `title +
description` as the caption — useful for testing without paying.

### Facebook Page Access Token

This is the trickiest one. You need a **long-lived Page token**, not a User
token, with `pages_manage_posts` + `publish_video` granted.

1. **Create a Meta app** at <https://developers.facebook.com/apps> → type
   *Business*.
2. **Add yourself as Admin/Tester** under App Roles → Roles. Required while
   the app is in Development mode.
3. **Generate a User token** at the
   [Graph API Explorer](https://developers.facebook.com/tools/explorer/):
   - Select your app from the top-right dropdown.
   - User or Page → Get User Access Token.
   - Add permissions: `pages_show_list`, `pages_read_engagement`,
     `pages_manage_posts`, `publish_video`.
   - Generate.
4. **Find your Page token** by running this query in Graph Explorer:
   ```
   me/accounts?fields=name,id,access_token
   ```
   The response contains an entry per Page. The **`id`** is the Page ID; the
   **`access_token`** is your short-lived Page token.
5. **Exchange for a long-lived token (~60 days):**
   ```bash
   curl -G "https://graph.facebook.com/v21.0/oauth/access_token" \
     -d "grant_type=fb_exchange_token" \
     -d "client_id=YOUR_APP_ID" \
     -d "client_secret=YOUR_APP_SECRET" \
     -d "fb_exchange_token=PAGE_TOKEN_FROM_STEP_4"
   ```
   The response's `access_token` is what goes in the UI.
6. **Verify** the token belongs to a Page, not your user:
   ```bash
   curl "https://graph.facebook.com/v21.0/me?access_token=NEW_TOKEN"
   ```
   Must return `{"name": "<Your Page Name>", "id": "<page id>", ...}` — if it
   returns your personal user account, you grabbed the wrong token.

**60-day expiry** — the long-lived token still expires. Set a calendar reminder
to repeat steps 3–5 every ~50 days. (A token-refresh cron is on the roadmap
but not implemented.)

---

## Reposting flows

The reposting page supports two flows. Each reposting "account" is bound to one
flow at creation time and holds its own destination credentials and history.

| Flow | Source | Destination | Credentials needed |
| --- | --- | --- | --- |
| `yt-to-fb` | YouTube Shorts URL | Facebook Page | YouTube API key (shared), Facebook Page Access Token + Page ID (per account) |
| `ig-to-yt` | Instagram Reel URL | YouTube channel | Google OAuth client (shared, env), per-account YouTube channel via OAuth |

Shared credentials (`YouTube API key`, `OpenRouter API key`, `OpenRouter model`)
live in `data/reposting/shared.json` and are used by every account. Per-account
credentials live in `data/reposting/<id>/`.

## YouTube OAuth setup (for `ig-to-yt`)

YouTube uploads use OAuth 2.0 with the `youtube.upload` scope. You'll set up an
OAuth client once; each reposting account then connects its own Google account
through the in-app **Connect YouTube** button.

1. **Google Cloud Console → APIs & Services → Library** → enable
   **YouTube Data API v3** (skip if you already enabled it for the search key).
2. **OAuth consent screen** → External → fill the required fields → add scope
   `https://www.googleapis.com/auth/youtube.upload`. While in *Testing* mode,
   add yourself (and any other Google account you'll connect) as test users.
3. **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/reposting/oauth/youtube/callback`
     (and your production URL when you deploy)
4. Copy **Client ID** and **Client secret** into `.env.local`:
   ```
   YT_OAUTH_CLIENT_ID=...
   YT_OAUTH_CLIENT_SECRET=...
   # optional override; defaults to ${BETTER_AUTH_URL}/api/reposting/oauth/youtube/callback
   # YT_OAUTH_REDIRECT_URI=
   ```
5. Restart the dev server. In the app, create an `ig-to-yt` reposting account
   and click **Connect YouTube** on the destination card. Complete the consent
   flow. Refresh tokens are stored at
   `data/reposting/<accountId>/youtube-oauth.json`.

**Quota warning:** the default `videos.insert` quota is **1,600 units per
upload** against a daily 10,000-unit limit, i.e. ~6 uploads/day per Google
project. Apply for a YouTube API audit if you need more.

**Channel must be phone-verified** for `videos.insert` to succeed. Verify at
youtube.com → Settings → Channel status and features.

## Reposting feature — first run

1. Open `/reposting`.
2. Fill in **Shared settings** (YouTube API key, OpenRouter key) → Save.
3. Click **+ Add Account** → pick a flow → name it.
4. **For `yt-to-fb`:** fill the Facebook Page Access Token + Page ID, Save.
5. **For `ig-to-yt`:** click **Connect YouTube**, complete OAuth.
6. In the queue, paste a source URL (Shorts or Reel depending on flow):
   - Set a **Scheduled at** time at least 11 minutes in the future, or
   - Tick **Post now** (publishes immediately).
7. Click **Schedule all** and watch the activity log:
   `metadata → download → caption → upload → done`.
8. Verify in the destination platform's scheduler.

The browser request stays open for the full pipeline (often 30–60s per item).
Don't close the tab mid-run.

---

## Deployment (VPS)

This project does not run on Vercel — see [Why not Vercel](#why-not-vercel).
Below is a minimal recipe for a $5/mo Linux VPS (Hetzner CX11, DigitalOcean
nanode, Hostinger KVM 1, etc).

### One-time setup on the VPS

```bash
# 1. Base packages
sudo apt update
sudo apt install -y curl git build-essential ffmpeg

# 2. Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm

# 3. Latest yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# 4. Caddy (auto-HTTPS reverse proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

### Deploy the app

```bash
# Clone + install
git clone <repo-url> /srv/fb-auto
cd /srv/fb-auto
pnpm install

# Playwright (only if using browser automation)
pnpm exec playwright install --with-deps chromium

# Configure
cp .env.example .env.local
# Edit .env.local — set BETTER_AUTH_URL=https://yourdomain.tld
nano .env.local
pnpm auth:migrate

# Build
pnpm build
```

### Run as a service (systemd)

`/etc/systemd/system/fb-auto.service`:

```ini
[Unit]
Description=fb-auto Next.js
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/srv/fb-auto
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /srv/fb-auto
sudo systemctl daemon-reload
sudo systemctl enable --now fb-auto
sudo journalctl -u fb-auto -f   # tail logs
```

### Reverse proxy with HTTPS

`/etc/caddy/Caddyfile`:

```
yourdomain.tld {
    reverse_proxy localhost:3000 {
        # Streaming endpoints (NDJSON) need long timeouts
        flush_interval -1
        transport http {
            read_timeout 600s
            write_timeout 600s
        }
    }
}
```

```bash
sudo systemctl reload caddy
```

Caddy automatically provisions Let's Encrypt certificates. Visit
`https://yourdomain.tld` — done.

### Post-deploy checklist

- [ ] Update Google OAuth redirect URI to the production domain
- [ ] Update `BETTER_AUTH_URL` in `.env.local` to the HTTPS URL
- [ ] Verify `data/` is owned by the service user and **backed up** (it
      contains your reposting config, schedule history, and FB session state)
- [ ] Calendar reminder for FB Page token re-exchange (every ~50 days)
- [ ] Set up monitoring — even `journalctl --grep=ERROR` via cron is better
      than nothing

---

## Why not Vercel?

The reposting pipeline shells out to `yt-dlp` and `ffmpeg`, writes to the
local filesystem (`data/reposting-*.json`), and runs single requests for up to
several minutes. Vercel serverless functions don't have those binaries, the
filesystem outside `/tmp` is read-only, and execution time is capped (10s
Hobby / 300s Pro / 800s Enterprise). The browser-automation code can't run
either — Playwright's Chromium binary won't be in the build, and even if it
were, the cold-start time would make it impractical.

A split deployment is feasible — Vercel for the UI, Trigger.dev / Inngest /
a worker VPS for the actual download+upload — but it's a real architecture
change, not a configuration tweak. For a personal project, **a single VPS is
significantly simpler.**

---

## Troubleshooting

### yt-dlp: "Precondition check failed" or "nsig extraction failed"

YouTube changed their player; your yt-dlp is out of date. Re-run the curl
install command from the [Prerequisites](#1-system-binaries-the-hard-blockers)
section to grab the latest release.

### Facebook upload: `(#100) No permission to publish the video`

Your `FB_PAGE_ACCESS_TOKEN` is a **User token**, not a Page token. Verify with:

```bash
curl "https://graph.facebook.com/v21.0/me?access_token=YOUR_TOKEN"
```

If that returns your personal name (e.g. `"name": "Jane Doe"`), it's a User
token. Re-do step 4 of [Facebook Page Access Token](#facebook-page-access-token)
and grab the `access_token` from inside the *Pages* array.

### FormData error "Expected value … to be an instance of Blob"

Old code path — already fixed in `lib/reposting/facebook.ts`. If you still
see it, you have a stale dev process. Stop and restart `pnpm dev`.

### "fetch failed" with no status code on caption step

OpenRouter is unreachable, the key has whitespace, or the key has no credits.
Run the diagnostic curl from
[Reposting credentials → OpenRouter](#openrouter-llm-caption-writer):

```bash
curl -sS https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"anthropic/claude-haiku-4.5","max_tokens":20,
       "messages":[{"role":"user","content":"hi"}]}'
```

- 200 → key works; restart `pnpm dev` so it re-reads `.env.local`
- 401 → key invalid
- 402 → no credits, top up at <https://openrouter.ai/credits>

### Activity log shows everything succeed but nothing in FB

Open Meta Business Suite → **Planner** (not the regular Page feed). Scheduled
posts only show in Planner until their publish time arrives.

### Scheduled time errors: "must be at least 11 minutes in the future"

Hard FB API constraint — `scheduled_publish_time` must be 10 minutes to 6
months out. We use 11 to give a buffer. Pick a later time or use **Post now**.

---

## For AI agents

If you're an automated coding assistant working on this project:

1. **Read `AGENTS.md`** for Next.js framework rules — this codebase uses a
   pre-release Next.js whose APIs differ from your training data.
2. **Don't try to run the reposting pipeline without the binaries.** The
   reposting feature requires `yt-dlp` and `ffmpeg` on `$PATH`. If the user
   asks you to "test" it, first verify with `which yt-dlp ffmpeg` and stop
   if they're missing — instruct the user to install them per the
   [Prerequisites](#1-system-binaries-the-hard-blockers) section.
3. **Don't recommend Vercel deployment** — see [Why not Vercel](#why-not-vercel).
   The blockers are infrastructure, not code, and can't be fixed by editing.
4. **Persistent files live in `data/`** (gitignored). Don't add code that
   assumes a writable filesystem in production *unless* you also confirm the
   target environment is a real server, not serverless.
5. **Token expiry is a real failure mode.** When debugging "it worked
   yesterday and now it doesn't" reports, suspect the FB Page token first
   (60-day window) before suspecting code regressions.
6. **Secrets boundary:** `data/reposting-config.json` stores plaintext keys
   for a single-user assumption. Never widen the GET endpoint, log raw
   tokens, or commit any file under `data/`.
