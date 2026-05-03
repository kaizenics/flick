<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Setup and runtime constraints

For environment setup, system binaries, deployment, and troubleshooting, see [SETUP.md](SETUP.md). Key things to know before suggesting changes:

- **Reposting pipeline shells out to `yt-dlp` and `ffmpeg`.** Verify with `which yt-dlp ffmpeg` before assuming the pipeline can run; instruct the user to install them per SETUP.md if missing.
- **Cannot deploy to Vercel** (no shell binaries, read-only filesystem, request timeout caps). VPS-only. See `SETUP.md → Why not Vercel`.
- **Persistent state lives in `data/`** (gitignored): reposting config, schedule history, FB session state. Don't add code that assumes a serverless / read-only filesystem.
- **`data/reposting-config.json` stores plaintext API keys** under a single-user assumption. Don't log raw tokens, broaden the config GET endpoint, or commit anything under `data/`.
- **Facebook Page tokens expire every ~60 days.** When debugging "it worked yesterday" reports, check token validity before code regressions.
