import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifySlackRequest } from "../../src/slack/signature.js";

describe("Slack request signatures", () => {
  it("accepts valid Slack signatures", () => {
    const rawBody = "token=x&team_id=T1&text=list";
    const timestamp = "1710000000";
    const secret = "secret";
    const signature = sign(secret, timestamp, rawBody);

    expect(
      verifySlackRequest({
        signingSecret: secret,
        rawBody,
        timestamp,
        signature,
        nowSeconds: 1710000100
      })
    ).toBe(true);
  });

  it("rejects stale Slack signatures", () => {
    const rawBody = "token=x&team_id=T1&text=list";
    const timestamp = "1710000000";
    const secret = "secret";

    expect(
      verifySlackRequest({
        signingSecret: secret,
        rawBody,
        timestamp,
        signature: sign(secret, timestamp, rawBody),
        nowSeconds: 1710000401
      })
    ).toBe(false);
  });
});

function sign(secret: string, timestamp: string, rawBody: string): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
}
