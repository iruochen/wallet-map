import { ChevronDown, ExternalLink } from "lucide-react";
import { buildExplorerAddressUrl } from "../../../app/chains";
import { shortenAddress } from "../../../app/format";
import type { Locale } from "../../i18n/i18n-provider";
import type { TranslateFn } from "../lib/formatters";
import { ChainBadge, EvidenceItemView, FindingChainBadges } from "./analysis-evidence";
import type { AnalysisResponse, GraphNode } from "../types";

const aggregatedFindingTitles = new Set([
  "Same contract interaction found",
  "Shared counterparty found",
  "Shared funding source found",
  "Shared withdrawal destination found",
]);

export function isAggregatedFindingGroup(title: string): boolean {
  return aggregatedFindingTitles.has(title);
}

export function SharedFindingRow({
  finding,
  fallbackChainId,
  watchedAddressSet,
  graphNodeIndex,
  locale,
  t,
}: {
  finding: AnalysisResponse["findings"][number];
  fallbackChainId: number;
  watchedAddressSet: Set<string>;
  graphNodeIndex: Map<string, GraphNode>;
  locale: Locale;
  t: TranslateFn;
}) {
  const subject = resolveFindingSubject(finding, graphNodeIndex, t);
  const watchedNodeIds =
    (finding as { metadata?: { watchedWalletNodeIds?: string[] } }).metadata?.watchedWalletNodeIds ?? [];
  const walletLabels = watchedNodeIds
    .map((nodeId) => graphNodeIndex.get(nodeId))
    .map((node) => node?.label ?? (node?.address ? shortenAddress(node.address) : undefined))
    .filter((label): label is string => Boolean(label));
  const previewEvidence = finding.evidence.slice(0, 4);
  const subjectChainId = subject.chainId ?? fallbackChainId;
  const subjectHref = subject.address ? buildExplorerAddressUrl(subjectChainId, subject.address) : undefined;

  return (
    <li className="sharedFindingCard">
      <details className="sharedFindingDetails">
        <summary className="sharedFindingSummary">
          <span className="sharedFindingSubject">
            <span className="sharedFindingSubjectLabel">{subject.label}</span>
            {subject.address && subjectHref ? (
              <a
                className="sharedFindingSubjectLink"
                href={subjectHref}
                target="_blank"
                rel="noreferrer noopener"
                title={subject.address}
                onClick={(event) => event.stopPropagation()}
              >
                <code>{shortenAddress(subject.address)}</code>
                <ExternalLink size={12} strokeWidth={2.1} aria-hidden="true" />
              </a>
            ) : (
              <code>{subject.address ? shortenAddress(subject.address) : "—"}</code>
            )}
          </span>
          <span className="sharedFindingMeta">
            <FindingChainBadges finding={finding} fallbackChainId={fallbackChainId} />
            <span>
              {t("analysis.evidence.sharedWallets", { count: Math.max(walletLabels.length, watchedNodeIds.length) })}
            </span>
            <span>{t("analysis.evidence.sharedTxs", { count: finding.evidence.length })}</span>
          </span>
          <ChevronDown size={15} strokeWidth={2.2} className="sharedFindingChevron" aria-hidden="true" />
        </summary>
        <div className="sharedFindingBody">
          {walletLabels.length > 0 ? (
            <div className="sharedWalletChipRow">
              {walletLabels.map((label) => (
                <span key={label} className="sharedWalletChip">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="evidenceList">
            {previewEvidence.map((evidence) => (
              <EvidenceItemView
                key={evidence.eventId}
                evidence={evidence}
                chainId={fallbackChainId}
                watchedAddressSet={watchedAddressSet}
                locale={locale}
                t={t}
              />
            ))}
          </div>
          {finding.evidence.length > previewEvidence.length || finding.evidenceTruncated ? (
            <p className="previewHint">
              {t("analysis.evidence.previewHint", {
                shown: previewEvidence.length,
                total: finding.evidenceTotal || finding.evidence.length,
              })}
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function resolveFindingSubject(
  finding: AnalysisResponse["findings"][number],
  graphNodeIndex: Map<string, GraphNode>,
  t: TranslateFn,
): { label: string; address?: string; chainId?: number } {
  const metadata = (finding as {
    metadata?: {
      contractNodeId?: string;
      counterpartyNodeId?: string;
    };
  }).metadata;

  if (metadata?.contractNodeId) {
    const node = graphNodeIndex.get(metadata.contractNodeId);
    return {
      label: t("analysis.evidence.subject.contract"),
      address: node?.address ?? extractAddress(metadata.contractNodeId),
      chainId: node?.chainId,
    };
  }

  if (metadata?.counterpartyNodeId) {
    const node = graphNodeIndex.get(metadata.counterpartyNodeId);
    return {
      label: t("analysis.evidence.subject.counterparty"),
      address: node?.address ?? extractAddress(metadata.counterpartyNodeId),
      chainId: node?.chainId,
    };
  }

  const firstEvent = finding.evidence[0]?.event;
  return {
    label: t("analysis.evidence.subject.generic"),
    address: firstEvent?.contract ?? firstEvent?.to ?? firstEvent?.from,
    chainId: firstEvent?.chainId,
  };
}

function extractAddress(nodeId: string): string | undefined {
  const match = /(0x[a-fA-F0-9]{40})/.exec(nodeId);
  return match?.[1];
}
