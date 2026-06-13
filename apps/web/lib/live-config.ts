export function readLiveConfigured(): boolean {
  return Boolean(
    process.env.NODEREAL_API_KEY?.trim() ||
      process.env.NODEREAL_BSC_API_KEY?.trim() ||
      process.env.ETHERSCAN_API_KEY?.trim() ||
      process.env.SOLSCAN_API_KEY?.trim(),
  );
}
