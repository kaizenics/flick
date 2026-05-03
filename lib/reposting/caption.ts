type CaptionArgs = {
  title: string;
  description: string;
  apiKey?: string;
  model?: string;
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
  const out = await callLLM(
    `Write a short, engaging Facebook caption (under 200 chars) with 3-5 relevant hashtags for this short video. Output the caption only, no preamble. Do not start with phrases like "Video by", "Reel by", or any author attribution.\n\nSource title: ${args.title}\nSource description: ${args.description}`,
    args,
  ).catch(() => null);
  if (out) return out;
  return `${args.title}\n\n${args.description.slice(0, 200)}`.trim();
}

export async function generateYoutubeMeta(
  args: CaptionArgs,
): Promise<{ title: string; description: string; tags: string[] }> {
  const prompt = `You are writing the title, description, and tags for a YouTube Short re-uploaded from another platform. Based on the source content below, output a JSON object with three fields:
- "title": a catchy YouTube Shorts title, MAX 80 characters, no quotes, no emojis at the start, no author attribution like "Video by", "Reel by", or "@username". Capture the actual subject of the clip.
- "description": 2-4 sentences describing the clip plus 4-8 relevant hashtags on the last line. Include "#Shorts" as the first hashtag.
- "tags": an array of 8-15 short search-friendly keyword strings (1-3 words each, no #). Mix broad ("shorts", "viral") and specific (subject-related) tags. Total combined tag length must stay under 450 characters.

Output ONLY valid JSON, no markdown, no preamble.

Source title (often unhelpful, ignore if it's just an attribution): ${args.title}
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
