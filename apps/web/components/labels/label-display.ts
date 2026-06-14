import { getSupportedAnalysisChain } from "../../app/chains";
import type { I18nKey } from "../i18n/i18n-provider";

type TranslateFn = (key: I18nKey, params?: Record<string, string | number>) => string;

const sourceKeys: Record<string, I18nKey> = {
  "local-labels": "labels.source.local",
  "static-label-registry": "labels.source.static",
  "chainbase-address-labels": "labels.source.chainbase",
  "etherscan-nametag": "labels.source.etherscan",
  "known-entity-labels": "labels.source.knownEntity",
};

const nodeKindKeys: Record<string, I18nKey> = {
  wallet: "labels.nodeKind.wallet",
  contract: "labels.nodeKind.contract",
  entity: "labels.nodeKind.entity",
  asset: "labels.nodeKind.asset",
};

const categoryKeys: Record<string, I18nKey> = {
  exchange: "labels.category.exchange",
  bridge: "labels.category.bridge",
  dex: "labels.category.dex",
  defi: "labels.category.defi",
  stablecoin: "labels.category.stablecoin",
  token: "labels.category.token",
  contract: "labels.category.contract",
  wallet: "labels.category.wallet",
  unknown: "labels.category.unknown",
};

export function formatLabelChainName(chainId: number): string {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return `Unknown chain (${chainId})`;
  }

  return `${chain.name} · ${chain.shortName}`;
}

export function formatLocalizedLabelChainName(t: TranslateFn, chainId: number): string {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return t("labels.chain.unknown", { chainId });
  }

  return `${chain.name} · ${chain.shortName}`;
}

export function formatLabelChainShort(chainId: number): string {
  const chain = getSupportedAnalysisChain(chainId);

  return chain?.shortName ?? String(chainId);
}

export function formatLabelSource(source: string): string {
  return source;
}

export function formatLocalizedLabelSource(t: TranslateFn, source: string): string {
  const key = sourceKeys[source];
  return key ? t(key) : source;
}

export function formatLabelNodeKind(nodeKind: string): string {
  return nodeKind;
}

export function formatLocalizedLabelNodeKind(t: TranslateFn, nodeKind: string): string {
  const key = nodeKindKeys[nodeKind];
  return key ? t(key) : nodeKind;
}

export function formatLabelCategory(category: string | undefined): string | undefined {
  if (!category) {
    return undefined;
  }

  return category;
}

export function formatLocalizedLabelCategory(t: TranslateFn, category: string | undefined): string | undefined {
  if (!category) {
    return undefined;
  }

  const key = categoryKeys[category];
  return key ? t(key) : category;
}

export function isLocalLabelSource(source: string): boolean {
  return source === "local-labels";
}
