export type CollectionResult = {
  processedSignals: number;
  postedSignals: number;
};

export async function runCollectionJob(): Promise<CollectionResult> {
  return { processedSignals: 0, postedSignals: 0 };
}
