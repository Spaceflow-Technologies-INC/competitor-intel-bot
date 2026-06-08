import type { IntelSignal } from "../types.js";

export type SignalSummarizer = {
  summarize(signals: IntelSignal[]): Promise<string>;
};

export class DeterministicSummarizer implements SignalSummarizer {
  async summarize(signals: IntelSignal[]): Promise<string> {
    if (signals.length === 0) {
      return "No new high-signal competitor movement found since the last digest.";
    }
    const top = signals[0];
    return [
      `${signals.length} source-backed competitor signal${signals.length === 1 ? "" : "s"} found.`,
      `Top movement: ${top?.claim ?? "n/a"}.`,
      "Review battlecards and product gaps for any customer-win, launch, pricing, or integration signals."
    ].join(" ");
  }
}

export class OpenAISignalSummarizer implements SignalSummarizer {
  constructor(private readonly options: { apiKey: string; model: string; fallback?: SignalSummarizer }) {}

  async summarize(signals: IntelSignal[]): Promise<string> {
    const fallback = this.options.fallback ?? new DeterministicSummarizer();
    if (signals.length === 0) {
      return fallback.summarize(signals);
    }
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify({
          model: this.options.model,
          store: false,
          input: [
            {
              role: "system",
              content: "Summarize competitor intelligence for Spaceflow. Be concise, source-backed, and operator-focused."
            },
            {
              role: "user",
              content: JSON.stringify(signals.slice(0, 8))
            }
          ]
        })
      });
      if (!response.ok) {
        return fallback.summarize(signals);
      }
      const json = await response.json() as OpenAIResponse;
      return extractResponseText(json) || fallback.summarize(signals);
    } catch {
      return fallback.summarize(signals);
    }
  }
}

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function extractResponseText(response: OpenAIResponse): string {
  if (response.output_text) {
    return response.output_text.trim();
  }
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
}
