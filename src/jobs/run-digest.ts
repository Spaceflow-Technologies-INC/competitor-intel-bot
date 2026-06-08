export type DigestResult = {
  postedSignals: number;
};

export async function runDailyDigestJob(): Promise<DigestResult> {
  return { postedSignals: 0 };
}
