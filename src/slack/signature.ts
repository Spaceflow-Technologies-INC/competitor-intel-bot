import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifySlackRequestInput = {
  signingSecret: string;
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  nowSeconds?: number;
};

const maxAgeSeconds = 60 * 5;

export function verifySlackRequest(input: VerifySlackRequestInput): boolean {
  if (!input.timestamp || !input.signature) {
    return false;
  }
  const timestamp = Number.parseInt(input.timestamp, 10);
  if (!Number.isInteger(timestamp)) {
    return false;
  }
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) {
    return false;
  }
  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const expected = `v0=${createHmac("sha256", input.signingSecret).update(base).digest("hex")}`;
  return safeEqual(expected, input.signature);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
