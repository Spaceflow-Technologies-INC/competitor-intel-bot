import type { SlackMessage } from "../types.js";

export class SlackClient {
  constructor(private readonly options: { token: string }) {}

  async postMessage(channel: string, message: SlackMessage): Promise<{ channel: string; ts: string }> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        channel,
        text: message.text,
        blocks: message.blocks
      })
    });
    const json = await response.json() as { ok?: boolean; channel?: string; ts?: string; error?: string };
    if (!json.ok || !json.channel || !json.ts) {
      throw new Error(`Slack post failed: ${json.error ?? "unknown_error"}`);
    }
    return { channel: json.channel, ts: json.ts };
  }
}
