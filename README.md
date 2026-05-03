# Lifty

Self-hosted automation for Facebook Page operations — runs on your own
Linux machine or VPS, not a serverless platform.

Two pillars:

- **Reposting pipeline** — paste a YouTube Shorts URL, let an LLM write a
  Facebook caption, and post (or natively schedule) to a Facebook Page.
  Powered by the Graph API, so scheduling is handed off to Facebook itself
  rather than depending on this app to be online at the publish time.
- **Browser automation** — Playwright-driven scripts that drive the regular
  Facebook UI for actions the Graph API doesn't expose (multi-Page identity
  switching, follow flows, post reactions). Useful when you need to act
  *as a Page* across many Pages from a single account.

A workflow editor (XYFlow / React Flow) lets you compose these primitives
into reusable pipelines, persisted per-user in a Turso database.

> ⚠️ **Not deployable to Vercel.** The reposting pipeline shells out to
> `yt-dlp` and `ffmpeg`, writes to disk, and runs requests for several
> minutes — none of which fit serverless. See
> [SETUP.md → Why not Vercel](SETUP.md#why-not-vercel) and the VPS deploy
> recipe.

---

## Tech stack

| Layer            | Choice                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| Framework        | **Next.js 16** (App Router, React Server Components)                                |
| Language         | TypeScript 5, React 19                                                              |
| Styling          | Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com), Radix UI primitives, Base UI   |
| Auth             | [better-auth](https://better-auth.com) — email/password + Google OAuth              |
| Database         | [Turso](https://turso.tech) (libSQL), accessed via [Kysely](https://kysely.dev)     |
| Workflow editor  | [@xyflow/react](https://reactflow.dev)                                              |
| Browser driver   | [Playwright](https://playwright.dev) (headless Chromium)                            |
| Video tools      | `yt-dlp` (download), `ffmpeg` (merge to 1080p mp4) — system binaries                |
| LLM              | [OpenRouter](https://openrouter.ai) — caption generation; default Claude Haiku 4.5  |
| Notifications    | sonner (toasts)                                                                     |
| Package manager  | pnpm 9 with workspace support                                                       |

The project uses **App Router exclusively**, route handlers for the API
layer, and `runtime = "nodejs"` everywhere that touches the filesystem or
shells out — i.e. all reposting routes.

### Repository layout

```
app/
  (app)/                     authenticated app routes (sidebar layout)
    reposting/               YouTube → FB queue + history UI
    flow/                    workflow editor
  api/
    reposting/
      schedule/              POST: streaming NDJSON pipeline
      config/                GET masked + POST writes to data/
      run/                   legacy single-shot search route
    workflows/               CRUD for saved flows
components/
  dashboard/                 RepostingPanel, sidebar, etc.
  ui/                        shadcn-generated primitives
lib/
  reposting/                 download.ts, youtube.ts, caption.ts,
                             facebook.ts, config-store.ts, schedule-store.ts
  automation/                Playwright FB drivers (browser, pageSwitch,
                             follow, reactions, runner)
  auth.ts, db.ts, store.ts, accounts.ts, logs.ts
data/                        runtime state (gitignored)
```

---

## Getting started

> Full walkthrough — including system binaries, Turso, Google OAuth, and
> the Facebook Page Access Token dance — in **[SETUP.md](SETUP.md)**.

Short version (Linux/WSL):

```bash
# System binaries
sudo apt install -y ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp

# App
pnpm install
cp .env.example .env.local        # fill in BETTER_AUTH_*, TURSO_*, GOOGLE_*
pnpm auth:migrate
pnpm dev
```

Open <http://localhost:3000>, sign in with Google, then visit `/reposting`
to configure your YouTube / OpenRouter / Facebook keys via the **Settings**
card.

---

## Contributing

Contributions are welcome — bug reports, feature ideas, and PRs alike.

### Development workflow

1. **Fork** and clone the repo, then create a topic branch off `main`:
   ```bash
   git checkout -b feat/<short-description>
   ```
2. **Set up locally** by following [SETUP.md](SETUP.md). The system binaries
   (`yt-dlp`, `ffmpeg`) are required for any work touching the reposting
   pipeline.
3. **Make focused commits.** A PR that does one thing is easier to review
   than a PR that does five.
4. **Type-check and lint before pushing:**
   ```bash
   pnpm exec tsc --noEmit
   pnpm lint
   ```
5. **Open a PR** against `main` with a description that covers the *why*,
   not just the *what*. Link any related issue.

### Branch naming

- `feat/<area>-<short-description>` — new feature
- `fix/<area>-<short-description>` — bug fix
- `refactor/<area>` — internal restructure with no behavior change
- `docs/<topic>` — docs-only changes

### Commit style

Conventional Commits with the same prefixes used in the repo's history:
`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Example:

```
feat(reposting): add OpenRouter model selector to settings UI
```

### Code conventions

- **Next.js 16 App Router only.** No Pages Router. See
  [AGENTS.md](AGENTS.md) — this version of Next has breaking changes from
  earlier majors; check `node_modules/next/dist/docs/` before relying on
  any API your training data remembers.
- **Server-only modules** (anything in `lib/reposting/` that reads
  `process.env`, writes files, or spawns processes) must never be imported
  from a Client Component. Route handlers and Server Components only.
- **shadcn-style components** in `components/ui/` are generated; prefer
  composing them in `components/dashboard/` rather than editing the
  primitives.
- **No `any` types** without a `// eslint-disable-next-line` and a comment
  explaining why.
- **Default to no comments.** Code should explain itself; comments are for
  surprising invariants or workarounds, not narrating what the code does.

### Things that need help

The roadmap below is open for grabs — feel free to pick something and PR.

- **FB Page token auto-refresh** — currently expires every ~60 days and the
  user has to re-do the Graph Explorer dance. A scheduled job to re-exchange
  the token would fix this.
- **Per-user secrets** — `data/reposting-config.json` is single-user. Move
  to a Kysely table keyed by `userId`.
- **Resumable upload** for videos > 1 GB or > 20 minutes (FB's `/videos`
  endpoint maxes out; their Resumable Upload API is the path forward).
- **Worker-mode option** for splitting the pipeline off the request-response
  cycle — would unlock partial Vercel-compat (UI on Vercel, worker
  elsewhere).
- **More automation primitives** — comment, share, message, story posting.

### Reporting bugs

Open an issue with:

- What you tried, what happened, what you expected.
- The exact error message — the activity log on `/reposting` is the most
  useful surface.
- Your platform (Linux/macOS/WSL distro + version).
- `yt-dlp --version` if the bug is in the download step (an outdated
  yt-dlp is the most common cause of pipeline failures).

### Security

If you find a security issue — anything that could let one user read or
write another user's tokens, expose API keys, or bypass auth — **don't open
a public issue**. Email the maintainer directly (see `package.json` →
author / repo metadata).

---

## License

MIT (see `LICENSE` if present, otherwise treat as MIT pending a formal file).
