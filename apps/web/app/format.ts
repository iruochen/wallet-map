export function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortenTxHash(hash: string): string {
  if (hash.length <= 14) {
    return hash;
  }

  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatAmount(rawAmount: string | undefined, decimals: number | undefined): string | undefined {
  if (rawAmount === undefined || rawAmount === "") {
    return undefined;
  }

  const safeDecimals = Number.isFinite(decimals ?? NaN) ? Number(decimals) : 18;

  if (safeDecimals === 0) {
    return rawAmount;
  }

  let raw = rawAmount.trim();
  let negative = false;

  if (raw.startsWith("-")) {
    negative = true;
    raw = raw.slice(1);
  }

  if (!/^[0-9]+$/.test(raw)) {
    return rawAmount;
  }

  const padded = raw.padStart(safeDecimals + 1, "0");
  const integerPart = padded.slice(0, padded.length - safeDecimals);
  const fractionPart = padded.slice(padded.length - safeDecimals).replace(/0+$/, "");
  const integerFormatted = Number(integerPart).toLocaleString("en-US");
  const formatted = fractionPart
    ? `${integerFormatted}.${truncateFraction(fractionPart)}`
    : integerFormatted;

  return negative ? `-${formatted}` : formatted;
}

function truncateFraction(fraction: string, maxFractionDigits = 6): string {
  return fraction.length > maxFractionDigits ? fraction.slice(0, maxFractionDigits) : fraction;
}

export function formatRelativeTime(isoTimestamp: string | undefined, now: Date = new Date()): string | undefined {
  if (!isoTimestamp) {
    return undefined;
  }

  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const diffMs = now.getTime() - date.getTime();
  const future = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const seconds = Math.round(absMs / 1000);

  if (seconds < 60) {
    return future ? `in ${seconds}s` : `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return future ? `in ${minutes}m` : `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return future ? `in ${hours}h` : `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 30) {
    return future ? `in ${days}d` : `${days}d ago`;
  }

  const months = Math.round(days / 30);
  if (months < 24) {
    return future ? `in ${months}mo` : `${months}mo ago`;
  }

  const years = Math.round(months / 12);
  return future ? `in ${years}y` : `${years}y ago`;
}

export function formatAbsoluteTime(isoTimestamp: string | undefined): string | undefined {
  if (!isoTimestamp) {
    return undefined;
  }

  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

const eventTypeLabels: Record<string, string> = {
  native_transfer: "Native Transfer",
  token_transfer: "Token Transfer",
  nft_transfer: "NFT Transfer",
  contract_call: "Contract Call",
  bridge: "Bridge",
  dex_swap: "DEX Swap",
};

export function formatEventTypeLabel(type: string | undefined): string {
  if (!type) {
    return "Event";
  }

  return eventTypeLabels[type] ?? toTitleCase(type);
}

const edgeKindLabels: Record<string, string> = {
  native_transfer: "Native Transfer",
  token_transfer: "Token Transfer",
  nft_transfer: "NFT Transfer",
  contract_interaction: "Contract Interaction",
  shared_counterparty: "Shared Counterparty",
  temporal_similarity: "Temporal Similarity",
  bridge_route: "Bridge Route",
};

export function formatEdgeKindLabel(kind: string | undefined): string {
  if (!kind) {
    return "Edge";
  }

  return edgeKindLabels[kind] ?? toTitleCase(kind);
}

const methodSelectorLabels: Record<string, string> = {
  "0xa9059cbb": "ERC20 Transfer",
  "0x095ea7b3": "ERC20 Approve",
  "0x23b872dd": "ERC20 Transfer From",
  "0x2e1a7d4d": "Withdraw",
  "0xd0e30db0": "Deposit",
};

export function formatMethodSelectorLabel(methodId: string | undefined): string | undefined {
  if (!methodId) {
    return undefined;
  }

  return methodSelectorLabels[methodId.toLowerCase()] ?? undefined;
}

export function formatMethodSelectorDisplay(methodId: string | undefined): string | undefined {
  if (!methodId) {
    return undefined;
  }

  const label = formatMethodSelectorLabel(methodId);
  return label ? `${label} (${methodId})` : methodId;
}

function toTitleCase(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
