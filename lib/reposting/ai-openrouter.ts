type OpenRouterArgs = {
  apiKey?: string;
  model?: string;
  prompt: string;
};

function cleanJsonText(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function callOpenRouterJson<T>(
  args: OpenRouterArgs,
): Promise<T> {
  const apiKey = args.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenRouter API key is not configured. Add it in Shared settings before using AI Copilot.",
    );
  }

  const model =
    args.model || process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `${args.prompt}\n\nReturn only valid JSON. No markdown.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("OpenRouter returned empty content");
  return JSON.parse(cleanJsonText(raw)) as T;
}
