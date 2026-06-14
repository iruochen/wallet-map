import { ChevronDown } from "lucide-react";
import { shortenAddress } from "../../../app/format";
import type { Locale } from "../../i18n/i18n-provider";
import type { TranslateFn } from "../lib/formatters";
import { EdgeRow, ChainBadge } from "./analysis-evidence";
import type { GraphEdge, GraphNode } from "../types";

export interface AggregatedEdgeGroup {
  key: string;
  kind: GraphEdge["kind"];
  source: string;
  target: string;
  edges: GraphEdge[];
  chainIds: number[];
  txCount: number;
}

export function aggregateEdgesForDisplay(edges: GraphEdge[]): AggregatedEdgeGroup[] {
  const grouped = new Map<string, AggregatedEdgeGroup>();

  for (const edge of edges) {
    const key = `${edge.kind}|${edge.source}|${edge.target}`;
    const current = grouped.get(key) ?? {
      key,
      kind: edge.kind,
      source: edge.source,
      target: edge.target,
      edges: [],
      chainIds: [],
      txCount: 0,
    };

    current.edges.push(edge);
    current.txCount += edge.metadata?.txCount ?? Math.max(1, edge.evidenceEventIds.length);
    const chainId = edge.metadata?.chainId;
    if (typeof chainId === "number" && !current.chainIds.includes(chainId)) {
      current.chainIds.push(chainId);
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((left, right) => right.txCount - left.txCount);
}

export function AggregatedEdgeRow({
  group,
  chainId,
  watchedAddressSet,
  nodeIndex,
  locale,
  t,
}: {
  group: AggregatedEdgeGroup;
  chainId: number;
  watchedAddressSet: Set<string>;
  nodeIndex: Map<string, GraphNode>;
  locale: Locale;
  t: TranslateFn;
}) {
  const sourceNode = nodeIndex.get(group.source);
  const targetNode = nodeIndex.get(group.target);
  const sourceLabel = shortenAddress(sourceNode?.address ?? sourceNode?.label ?? group.source);
  const targetLabel = shortenAddress(targetNode?.address ?? targetNode?.label ?? group.target);
  const previewEdges = group.edges.slice(0, 3);
  const singleEdge = group.edges.length === 1 && group.txCount <= 1;

  if (singleEdge) {
    return (
      <EdgeRow
        edge={group.edges[0]!}
        chainId={chainId}
        watchedAddressSet={watchedAddressSet}
        nodeIndex={nodeIndex}
        locale={locale}
        t={t}
      />
    );
  }

  return (
    <li className="aggregatedEdgeCard">
      <details className="aggregatedEdgeDetails">
        <summary className="aggregatedEdgeSummary">
          <span className="aggregatedEdgeRoute">
            <span className="aggregatedEdgeEndpoint" title={sourceLabel}>
              {sourceLabel}
            </span>
            <span className="aggregatedEdgeArrow" aria-hidden="true">
              →
            </span>
            <span className="aggregatedEdgeEndpoint" title={targetLabel}>
              {targetLabel}
            </span>
          </span>
          <span className="aggregatedEdgeMeta">
            {group.chainIds.slice(0, 2).map((edgeChainId) => (
              <ChainBadge key={edgeChainId} chainId={edgeChainId} />
            ))}
            <span>{t("analysis.evidence.edgeGroupTx", { count: group.txCount })}</span>
            <span>{t("analysis.evidence.edgeGroupRecords", { count: group.edges.length })}</span>
          </span>
          <ChevronDown size={15} strokeWidth={2.2} className="aggregatedEdgeChevron" aria-hidden="true" />
        </summary>
        <div className="aggregatedEdgeBody">
          <ul className="edgeList edgeListNested">
            {previewEdges.map((edge) => (
              <EdgeRow
                key={edge.id}
                edge={edge}
                chainId={chainId}
                watchedAddressSet={watchedAddressSet}
                nodeIndex={nodeIndex}
                locale={locale}
                t={t}
              />
            ))}
          </ul>
          {group.edges.length > previewEdges.length ? (
            <p className="previewHint">
              {t("analysis.evidence.previewHint", {
                shown: previewEdges.length,
                total: group.edges.length,
              })}
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}
