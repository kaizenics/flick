export async function generateCaption(args: {
  title: string;
  description: string;
  apiKey?: string;
  model?: string;
}): Promise<string> {
  const apiKey = args.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return `${args.title}\n\n${args.description.slice(0, 200)}`.trim();
  }

  const model = args.model || process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Write a short, engaging Facebook caption (under 200 chars) with 3-5 relevant hashtags for this short video. Output the caption only, no preamble.\n\nTitle: ${args.title}\nDescription: ${args.description}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? args.title;
}
