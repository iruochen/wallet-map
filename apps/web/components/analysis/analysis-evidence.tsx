import { ArrowRight, ExternalLink } from "lucide-react";
import {
  buildExplorerAddressUrl,
  buildExplorerTokenUrl,
  buildExplorerTxUrl,
  getSupportedAnalysisChain,
} from "../../app/chains";
import type { AnalysisResponse, EvidenceItem, GraphEdge, GraphNode } from "./analysis-types";
import {
  formatAbsoluteTime,
  formatAmount,
  formatEdgeKindLabel,
  formatEventTypeLabel,
  formatMethodSelectorLabel,
  formatRelativeTime,
  shortenAddress,
  shortenTxHash,
} from "../../app/format";

export function EvidenceItemView({
  evidence,
  chainId,
  watchedAddressSet,
}: {
  evidence: EvidenceItem;
  chainId: number;
  watchedAddressSet: Set<string>;
}) {
  const event = evidence.event;
  const txHash = event?.txHash ?? evidence.txHash;
  const eventChainId = event?.chainId ?? chainId;
  const txHref = txHash ? buildExplorerTxUrl(eventChainId, txHash) : undefined;
  const eventChain = getSupportedAnalysisChain(eventChainId);
  const isNativeAsset = event?.asset?.kind === "native";
  const amountDecimals = isNativeAsset
    ? eventChain?.nativeDecimals ?? 18
    : event?.asset?.decimals;
  const canRenderAmount =
    event?.amount !== undefined &&
    event.amount !== "" &&
    (isNativeAsset || event?.asset?.decimals !== undefined);
  const amountFormatted = canRenderAmount ? formatAmount(event?.amount, amountDecimals) : undefined;
  const amountSymbol = event?.asset?.symbol ?? (isNativeAsset ? eventChain?.nativeSymbol : undefined);

  return (
    <div className="evidenceItem">
      <div className="evidenceItemHeader">
        <span className={`eventTypePill event-${event?.type ?? "unknown"}`}>{formatEventTypeLabel(event?.type)}</span>
        <ChainBadge chainId={eventChainId} />
        {amountFormatted ? (
          <span className="amountChip">
            <strong>{amountFormatted}</strong>
            {amountSymbol ? <span>{amountSymbol}</span> : null}
          </span>
        ) : null}
        {event?.transferScope === "internal" ? <span className="scopeChip">internal</span> : null}
        {event?.asset?.tokenId ? <span className="scopeChip">#{event.asset.tokenId}</span> : null}
        {formatRelativeTime(event?.timestamp) ? (
          <span className="evidenceTime" title={formatAbsoluteTime(event?.timestamp)}>
            {formatRelativeTime(event?.timestamp)}
          </span>
        ) : null}
      </div>
      <div className="evidenceItemBody">
        {event?.from ? (
          <AddressLink address={event.from} chainId={eventChainId} role="from" watchedAddressSet={watchedAddressSet} />
        ) : null}
        <ArrowRight size={14} strokeWidth={2.2} className="evidenceArrowIcon" aria-hidden="true" />
        {event?.to ? (
          <AddressLink address={event.to} chainId={eventChainId} role="to" watchedAddressSet={watchedAddressSet} />
        ) : event?.contract ? (
          <AddressLink
            address={event.contract}
            chainId={eventChainId}
            role="contract"
            watchedAddressSet={watchedAddressSet}
            label="contract"
          />
        ) : (
          <span className="evidenceUnknown">unknown</span>
        )}
      </div>
      <div className="evidenceItemFooter">
        {txHash ? (
          <a className="txLink" href={txHref} target="_blank" rel="noreferrer noopener" title={txHash}>
            <ExternalLink size={13} strokeWidth={2.1} aria-hidden="true" />
            <code>{shortenTxHash(txHash)}</code>
          </a>
        ) : (
          <code className="evidenceEventId" title={evidence.eventId}>{evidence.eventId}</code>
        )}
        {event?.asset?.contract && event.asset.kind !== "native" ? (
          <TokenLink chainId={eventChainId} contract={event.asset.contract} symbol={event.asset.symbol} />
        ) : null}
      </div>
    </div>
  );
}

export function EdgeRow({
  edge,
  chainId,
  watchedAddressSet,
  nodeIndex,
}: {
  edge: GraphEdge;
  chainId: number;
  watchedAddressSet: Set<string>;
  nodeIndex: Map<string, GraphNode>;
}) {
  const edgeChainId = edge.metadata?.chainId ?? chainId;
  const eventChain = getSupportedAnalysisChain(edgeChainId);
  const isNativeAsset = edge.metadata?.asset?.kind === "native";
  const amountDecimals = isNativeAsset
    ? eventChain?.nativeDecimals ?? 18
    : edge.metadata?.asset?.decimals;
  const canRenderAmount =
    edge.metadata?.amount !== undefined &&
    edge.metadata.amount !== "" &&
    (isNativeAsset || edge.metadata?.asset?.decimals !== undefined);
  const amountFormatted = canRenderAmount ? formatAmount(edge.metadata?.amount, amountDecimals) : undefined;
  const amountSymbol = edge.metadata?.asset?.symbol ?? (isNativeAsset ? eventChain?.nativeSymbol : undefined);
  const txHash = edge.metadata?.txHash;
  const txHref = txHash ? buildExplorerTxUrl(edgeChainId, txHash) : undefined;

  return (
    <li className="edgeRow">
      <div className="edgeRowHeader">
        <span className={`eventTypePill event-${edge.kind}`}>{formatEdgeKindLabel(edge.kind)}</span>
        <ChainBadge chainId={edgeChainId} />
        {(edge.metadata?.txCount ?? 1) > 1 ? <span className="countChip">{edge.metadata?.txCount} tx</span> : null}
        {amountFormatted ? (
          <span className="amountChip">
            <strong>{amountFormatted}</strong>
            {amountSymbol ? <span>{amountSymbol}</span> : null}
          </span>
        ) : null}
        {edge.metadata?.methodId ? (
          <span className="methodChip">{formatMethodSelectorLabel(edge.metadata.methodId) ?? edge.metadata.methodId}</span>
        ) : null}
      </div>
      <div className="edgeRowBody">
        <GraphNodeLink node={nodeIndex.get(edge.source)} fallbackId={edge.source} chainId={edgeChainId} watchedAddressSet={watchedAddressSet} />
        <ArrowRight size={14} strokeWidth={2.2} className="evidenceArrowIcon" aria-hidden="true" />
        <GraphNodeLink node={nodeIndex.get(edge.target)} fallbackId={edge.target} chainId={edgeChainId} watchedAddressSet={watchedAddressSet} />
      </div>
      <div className="edgeRowFooter">
        {txHash ? (
          <a className="txLink" href={txHref} target="_blank" rel="noreferrer noopener" title={txHash}>
            <ExternalLink size={13} strokeWidth={2.1} aria-hidden="true" />
            <code>{shortenTxHash(txHash)}</code>
          </a>
        ) : (
          <code className="evidenceEventId" title={edge.id}>{edge.id}</code>
        )}
        {edge.metadata?.asset?.contract && !isNativeAsset ? (
          <TokenLink chainId={edgeChainId} contract={edge.metadata.asset.contract} symbol={edge.metadata.asset.symbol} />
        ) : null}
      </div>
    </li>
  );
}

export function ChainBadge({ chainId }: { chainId: number }) {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return null;
  }

  return <span className="chainBadge">{chain.shortName}</span>;
}

export function FindingChainBadges({
  finding,
  fallbackChainId,
}: {
  finding: AnalysisResponse["findings"][number];
  fallbackChainId: number;
}) {
  const chainIds = Array.from(
    new Set(
      finding.evidence
        .map((evidence) => evidence.event?.chainId ?? fallbackChainId)
        .filter((chainId) => Number.isFinite(chainId)),
    ),
  );

  return (
    <>
      {chainIds.slice(0, 3).map((chainId) => (
        <ChainBadge key={chainId} chainId={chainId} />
      ))}
    </>
  );
}

function AddressLink({
  address,
  chainId,
  role,
  watchedAddressSet,
  label,
  isContract,
}: {
  address: string;
  chainId: number;
  role: "from" | "to" | "contract" | "source" | "target";
  watchedAddressSet: Set<string>;
  label?: string;
  isContract?: boolean;
}) {
  const isWatched = watchedAddressSet.has(address.toLowerCase());
  const pillKind = isContract ? "contract" : isWatched ? "watched" : "observed";
  const roleLabel = label ?? (isContract ? "contract" : isWatched ? "watched" : "observed");

  return (
    <span className={`addressLink addressLink-${role} addressLink-${pillKind}`}>
      <span className="addressRoleTag">{roleLabel}</span>
      <a href={buildExplorerAddressUrl(chainId, address)} target="_blank" rel="noreferrer noopener" title={address} className="addressValue">
        {shortenAddress(address)}
      </a>
    </span>
  );
}

function TokenLink({ chainId, contract, symbol }: { chainId: number; contract: string; symbol?: string }) {
  return (
    <a href={buildExplorerTokenUrl(chainId, contract)} target="_blank" rel="noreferrer noopener" className="tokenChip" title={contract}>
      {symbol ?? "token"} <ExternalLink size={12} strokeWidth={2.1} aria-hidden="true" />
    </a>
  );
}

function GraphNodeLink({
  node,
  fallbackId,
  chainId,
  watchedAddressSet,
}: {
  node?: GraphNode;
  fallbackId: string;
  chainId: number;
  watchedAddressSet: Set<string>;
}) {
  const address = node?.address ?? extractAddressFromNodeId(fallbackId);
  const isContract = node?.kind === "contract";
  const isWatched = node?.kind === "wallet" && (node.tags?.includes("watched") ?? watchedAddressSet.has(address.toLowerCase()));
  const roleLabel = isContract ? "contract" : isWatched ? "watched" : "observed";
  const pillKind = isContract ? "contract" : isWatched ? "watched" : "observed";

  return (
    <span className={`addressLink addressLink-${pillKind}`}>
      <span className="addressRoleTag">{roleLabel}</span>
      <a href={buildExplorerAddressUrl(node?.chainId ?? chainId, address)} target="_blank" rel="noreferrer noopener" title={address} className="addressValue">
        {node?.label ?? shortenAddress(address)}
      </a>
    </span>
  );
}

function extractAddressFromNodeId(nodeId: string): string {
  const match = /(0x[a-fA-F0-9]{40})/.exec(nodeId);
  return match?.[1] ?? nodeId;
}
