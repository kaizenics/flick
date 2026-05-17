type CaptionArgs = {
  title: string;
  description: string;
  apiKey?: string;
  model?: string;
  bannedHashtags?: string[];
};

async function callLLM(prompt: string, args: CaptionArgs): Promise<string | null> {
  const apiKey = args.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const model = args.model || process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

export async function generateCaption(args: CaptionArgs): Promise<string> {
  const banned = args.bannedHashtags?.length
    ? `- Do NOT use these hashtags: ${args.bannedHashtags.map((t) => `#${t.replace(/^#/, "")}`).join(", ")}.`
    : "";
  const out = await callLLM(
    `You are writing the Facebook caption for a short video. Goal: maximize watch-time and shares so the algorithm pushes the post. Output the caption only, no preamble. Under 200 chars total including hashtags.

Hook craft (pick ONE that fits the clip; don't combine):
- Open mid-action or with a vivid sensory detail ("That sound when…").
- Curiosity gap — tease the payoff without spoiling it ("Wait for the end…", "You won't believe what he does at 0:08").
- Stakes / consequence ("This is why you never…", "The mistake that cost him everything").
- Bold claim or contrarian POV ("Most people get this wrong.").
- Direct second-person ("If you've ever felt this, you'll get it.").
- Pattern interrupt — short, punchy, unexpected.
First 5-7 words must stop the scroll. No throat-clearing, no "Check out this…", no "Here's a video of…".

Engagement bait that actually works (use sparingly, max one):
- A genuine question tied to the clip's subject ("Would you have reacted the same?")
- A "tag a friend who…" only if it's specific and natural.

Hashtags (3-5, end of caption):
- Mix one broad reach tag (#fyp / #reels / #viral / one platform-fit broad tag) with 2-4 specific subject tags.
- Specific tags must come from the actual subject of the clip, not vibes.

Hard rules — never violate:
- Do NOT include any date, year, month name, or day reference (no "April 12", "2026", "yesterday", "this week").
- Do NOT include author/attribution phrases ("Video by", "Reel by", "@username", "Posted by").
- Do NOT use vague filler hashtags like #MomentsThatMatter #EverydayMagic #Memories #Throwback #LifeIsBeautiful.
- Do NOT use hashtags that don't fit the destination platform.
- ${banned || "No additional banned hashtags."}
- No em-dash openers, no stock phrases ("capturing the moment", "what a vibe", "pure magic").
- No clickbait that the clip can't deliver on — promise must match payload.
- Write about what is actually happening in the clip.

Source title: ${args.title}
Source description: ${args.description}`,
    args,
  ).catch(() => null);
  if (out) return stripBannedHashtags(out, args.bannedHashtags);
  return stripBannedHashtags(`${args.title}\n\n${args.description.slice(0, 200)}`.trim(), args.bannedHashtags);
}

export async function generateYoutubeMeta(
  args: CaptionArgs,
): Promise<{ title: string; description: string; tags: string[] }> {
  const prompt = `You are writing the title, description, and tags for a YouTube Short re-uploaded from another platform. Optimize for YouTube Shorts retention + browse/search surfacing — the title and first sentence determine whether the algorithm keeps pushing it. Output a JSON object with three fields:

- "title": a scroll-stopping YouTube Shorts title, MAX 80 chars. Hook patterns that work on Shorts: curiosity gap ("Wait for the ending…"), bold claim ("Why nobody told you this"), specific number/stakes ("He lost $10K in 7 seconds"), pattern interrupt, or vivid first-action verb. Front-load the payoff. No quotes, no emojis at the start, no author attribution ("Video by", "Reel by", "@user"), no dates.

- "description": 2-4 sentences. Sentence 1 reinforces the hook with a curiosity gap or stakes. Sentence 2-3 add searchable subject context (helps Shorts Browse + suggested). End with 4-8 hashtags on a final line, "#Shorts" first, then specific subject tags. Avoid filler tags (#MomentsThatMatter, #EverydayMagic, #Throwback, #LifeIsBeautiful).

- "tags": 8-15 keyword strings (1-3 words, no "#"), all specific to the clip's subject + 1-2 broad ("shorts", "viral"). Combined length under 450 chars. Tags drive search; make them what someone would actually type.

Algorithm notes (apply to title + description):
- First 3 words must earn the swipe-up. Don't waste them.
- Match the language of the audience for that subject (gaming clip → gamer phrasing, cooking → cooking phrasing).
- Don't promise something the clip can't deliver — retention drops kill ranking.

Hard rules — never violate:
- No dates, years, month names, or day references anywhere.
- No author/attribution phrases.
- Title and description describe the clip's content, not its posting context.

Output ONLY valid JSON, no markdown, no preamble.

Source title (often unhelpful, ignore if it's just an attribution or date): ${args.title}
Source description / caption: ${args.description}`;

  const raw = await callLLM(prompt, args).catch(() => null);
  if (raw) {
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as {
        title?: string;
        description?: string;
        tags?: unknown;
      };
      const title = parsed.title?.trim();
      const description = parsed.description?.trim();
      const tags = sanitizeTags(parsed.tags);
      if (title && description) {
        return {
          title: title.slice(0, 100),
          description: description.slice(0, 4500),
          tags,
        };
      }
    } catch {
      // fall through to fallback
    }
  }
  // Fallback: salvage description; synthesize a title from first words.
  const desc = args.description.trim() || args.title;
  const firstLine = desc.split(/[\n.!?]/)[0]?.trim() || "Short clip";
  return {
    title: firstLine.slice(0, 80),
    description: `${desc.slice(0, 1000)}\n\n#Shorts`,
    tags: ["shorts", "viral"],
  };
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: string[] = [];
  let total = 0;
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const tag = t
      .trim()
      .replace(/^#/, "")
      .replace(/[",<>]/g, "")
      .slice(0, 30);
    if (!tag) continue;
    // YouTube combined tag limit is 500 chars.
    if (total + tag.length + 1 > 480) break;
    cleaned.push(tag);
    total += tag.length + 1;
    if (cleaned.length >= 15) break;
  }
  return cleaned;
}

function stripBannedHashtags(caption: string, banned?: string[]): string {
  if (!banned?.length) return caption;
  let out = caption;
  for (const raw of banned) {
    const tag = raw.trim().replace(/^#/, "");
    if (!tag) continue;
    const pattern = new RegExp(`(^|\\s)#${escapeRegExp(tag)}\\b`, "gi");
    out = out.replace(pattern, "$1");
  }
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
