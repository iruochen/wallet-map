"use client";

import { useMemo, useState } from "react";
import {
  buildExplorerAddressUrl,
  buildExplorerTokenUrl,
  buildExplorerTxUrl,
  getSupportedAnalysisChain,
  type SupportedAnalysisChain,
} from "./chains";
import {
  formatAbsoluteTime,
  formatAmount,
  formatEdgeKindLabel,
  formatEventTypeLabel,
  formatRelativeTime,
  shortenAddress,
  shortenTxHash,
} from "./format";
import { GraphExplorer } from "./graph-explorer";

const sampleAddresses = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "0xdddddddddddddddddddddddddddddddddddddddd",
].join("\n");

interface EvidenceEvent {
  type: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  from?: string;
  to?: string;
  contract?: string;
  methodId?: string;
  amount?: string;
  asset?: {
    kind: string;
    symbol?: string;
    contract?: string;
    decimals?: number;
    tokenId?: string;
  };
  transferScope?: string;
}

interface EvidenceItem {
  eventId: string;
  txHash?: string;
  summary: string;
  event?: EvidenceEvent;
}

interface GraphNode {
  id: string;
  kind: "wallet" | "contract" | "entity" | "asset";
  address?: string;
  chainId?: number;
  label?: string;
  tags?: string[];
}

interface GraphEdge {
  id: string;
  kind:
    | "native_transfer"
    | "token_transfer"
    | "nft_transfer"
    | "contract_interaction"
    | "shared_counterparty"
    | "temporal_similarity"
    | "bridge_route";
  source: string;
  target: string;
  weight?: number;
  evidenceEventIds: string[];
  metadata?: {
    chainId?: number;
    txHash?: string;
    amount?: string;
    methodId?: string;
    asset?: {
      kind?: string;
      symbol?: string;
      contract?: string;
      decimals?: number;
      tokenId?: string;
    };
  };
}

interface AnalysisResponse {
  mode: "fixture" | "live";
  source: string;
  sourceLabel?: string;
  meta: {
    chainId: number;
    chainName: string;
    requestedMode: "auto" | "fixture" | "live";
    resolvedMode: "fixture" | "live";
    watchedAddressCount: number;
    eventCount: number;
    graphWalletCount: number;
    graphContractCount: number;
    fallbackReason?: string;
    fetchedAt: string;
  };
  score: {
    score: number;
    confidence: "low" | "medium" | "high";
    reasons: string[];
    counterEvidence: string[];
  };
  graph: {
    totalNodes: number;
    totalEdges: number;
    nodesTruncated: boolean;
    edgesTruncated: boolean;
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  findings: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    confidence: string;
    evidenceTotal: number;
    evidenceTruncated: boolean;
    evidence: EvidenceItem[];
  }>;
}

interface AnalysisWorkbenchProps {
  liveConfigured: boolean;
  supportedChains: SupportedAnalysisChain[];
  initialAddresses?: string;
}

export function AnalysisWorkbench({
  liveConfigured,
  supportedChains,
  initialAddresses,
}: AnalysisWorkbenchProps) {
  const defaultAddresses = initialAddresses?.trim() ? initialAddresses : sampleAddresses;
  const [addresses, setAddresses] = useState(defaultAddresses);
  const [chainId, setChainId] = useState("1");
  const [dataMode, setDataMode] = useState("auto");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const addressCount = useMemo(
    () => addresses.split(/\s+/).filter((address) => address.trim().length > 0).length,
    [addresses],
  );
  const selectedChain = useMemo(
    () =>
      supportedChains.find((chain) => String(chain.chainId) === chainId) ??
      supportedChains[0],
    [chainId, supportedChains],
  );
  const modeDescription = useMemo(() => {
    if (dataMode === "live") {
      return liveConfigured
        ? "直接拉取 Etherscan API V2 的实时数据。"
        : "当前会请求实时数据；如果本地还没加载 key，这次运行会直接报错。";
    }

    if (dataMode === "fixture") {
      return "固定使用本地 fixture 数据，适合演示和回归测试。";
    }

    return liveConfigured
      ? "优先走实时数据；如果后面临时移除 key，会自动回退到 fixture。"
      : "当前会自动回退到 fixture，直到本地环境加载了 Etherscan API key。";
  }, [dataMode, liveConfigured]);

  const watchedAddressSet = useMemo(() => {
    if (!result) {
      return new Set<string>();
    }

    return new Set(
      result.graph.nodes
        .filter((node) => node.kind === "wallet" && node.tags?.includes("watched"))
        .map((node) => node.address?.toLowerCase() ?? ""),
    );
  }, [result]);

  const nodeById = useMemo(() => {
    if (!result) {
      return new Map<string, GraphNode>();
    }

    return new Map(result.graph.nodes.map((node) => [node.id, node]));
  }, [result]);

  const graphSummary = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      wallets: result.meta.graphWalletCount,
      contracts: result.meta.graphContractCount,
      edges: result.graph.totalEdges,
    };
  }, [result]);

  async function runAnalysis() {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addresses,
          chainId: Number(chainId),
          dataMode,
        }),
      });
      const body = (await response.json()) as AnalysisResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Analysis failed.");
      }

      setResult(body as AnalysisResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <>
    <section className="workspace">
      <form
        className="inputPanel"
        onSubmit={(event) => {
          event.preventDefault();
          void runAnalysis();
        }}
      >
        <div className="panelHeader">
          <div>
            <h2>分析输入</h2>
            <p>{selectedChain?.name ?? "Chain"} · {addressCount} addresses</p>
          </div>
          <button
            type="button"
            className="secondaryButton"
            disabled={isRunning}
            onClick={() => setAddresses(defaultAddresses)}
          >
            填入示例
          </button>
        </div>
        <div className="fieldGroup">
          <label htmlFor="addresses">钱包地址</label>
          <textarea
            id="addresses"
            name="addresses"
            disabled={isRunning}
            onChange={(event) => setAddresses(event.target.value)}
            placeholder={"0x...\n0x...\n0x..."}
            rows={8}
            value={addresses}
          />
          <p>每行或空格分隔一个地址；MVP 会先分析这些 watched wallets 之间的关系。</p>
        </div>
        <div
          className={`stateBanner ${liveConfigured ? "stateBannerSuccess" : "stateBannerInfo"}`}
          aria-live="polite"
        >
          <strong>{liveConfigured ? "实时数据已就绪" : "当前默认走本地 fixture"}</strong>
          <span>{modeDescription}</span>
        </div>
        <div className="formRow">
          <label>
            链
            <select
              disabled={isRunning}
              name="chainId"
              onChange={(event) => setChainId(event.target.value)}
              value={chainId}
            >
              {supportedChains.map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            数据源
            <select
              disabled={isRunning}
              name="dataMode"
              onChange={(event) => setDataMode(event.target.value)}
              value={dataMode}
            >
              <option value="auto">Auto</option>
              <option value="fixture">Fixture</option>
              <option value="live">Live</option>
            </select>
          </label>
        </div>
        <div className="chainList" aria-label="Supported live chains">
          {supportedChains.map((chain) => (
            <span
              key={chain.chainId}
              className={chain.chainId === selectedChain?.chainId ? "chainPill chainPillActive" : "chainPill"}
            >
              {chain.shortName}
            </span>
          ))}
        </div>
        <button type="submit" className="primaryButton" disabled={isRunning}>
          <span className={isRunning ? "buttonSpinner" : "buttonDot"} aria-hidden="true" />
          {isRunning ? "分析中..." : "生成分析任务"}
        </button>
        <div aria-live="polite" className="runStatus">
          {isRunning ? "正在拉取事件、构建关系图并运行分析器。" : "准备就绪"}
        </div>
        {error ? (
          <div className="stateBanner stateBannerError" role="alert">
            <strong>分析失败</strong>
            <span>{error}</span>
          </div>
        ) : null}
      </form>

      <div className="resultsColumn">
        <section className="resultPanel">
          <div className="resultHeader">
            <div>
              <h2>分析结果</h2>
              <p>
                {result
                  ? result.sourceLabel ??
                    `${result.meta.chainName} · ${
                      result.meta.resolvedMode === "live" ? "Live" : "Fixture"
                    }`
                  : "等待任务运行"}
              </p>
            </div>
            {result ? <span className="statusPill statusSuccess">Complete</span> : null}
            {isRunning ? <span className="statusPill statusRunning">Running</span> : null}
          </div>
          {isRunning ? (
            <LoadingResult />
          ) : result && graphSummary ? (
            <>
              <div className="scoreRow">
                <div>
                  <span>Score</span>
                  <strong>{result.score.score}/100</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>{result.score.confidence}</strong>
                </div>
              </div>
              {result.meta.fallbackReason ? (
                <div className="stateBanner stateBannerInfo">
                  <strong>本次用了 fixture 回退</strong>
                  <span>{result.meta.fallbackReason}</span>
                </div>
              ) : null}
              {result.score.reasons.length > 0 ? (
                <ul className="reasonList">
                  {result.score.reasons.map((reason, index) => (
                    <li key={`${reason}-${index}`}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <div className="emptyStateBlock emptyStatePositive">
                  <strong>没有命中任何关联规则</strong>
                  <p>当前分析器没有发现 watched 钱包之间的直接或间接关联。可以扩大地址、时间范围或切换链再试。</p>
                </div>
              )}
              <div className="metricGrid">
                <div>
                  <span>Watched</span>
                  <strong>{result.meta.watchedAddressCount}</strong>
                </div>
                <div>
                  <span>Events</span>
                  <strong>{result.meta.eventCount}</strong>
                </div>
                <div>
                  <span>Contracts</span>
                  <strong>{graphSummary.contracts}</strong>
                </div>
                <div>
                  <span>Edges</span>
                  <strong>{graphSummary.edges}</strong>
                </div>
              </div>
              <div className="metaGrid">
                <div>
                  <span>Requested mode</span>
                  <strong>{result.meta.requestedMode}</strong>
                </div>
                <div>
                  <span>Fetched at</span>
                  <strong>{formatFetchTime(result.meta.fetchedAt)}</strong>
                </div>
              </div>
              <p className="sourceLine">
                数据源: <code>{result.sourceLabel ?? result.source}</code>
              </p>
            </>
          ) : (
            <div className="emptyStateBlock">
              <strong>还没有分析结果</strong>
              <p>运行一次分析后，这里会显示评分、置信度和图谱摘要。</p>
            </div>
          )}
        </section>

        {isRunning ? (
          <section className="resultPanel">
            <div className="resultHeader">
              <div>
                <h2>Findings</h2>
                <p>分析器正在整理证据</p>
              </div>
            </div>
            <LoadingList />
          </section>
        ) : result ? (
          <>
            <section className="resultPanel">
              <div className="resultHeader">
                <div>
                  <h2>Findings</h2>
                  <p>
                    {result.findings.length} signals · {result.meta.chainName}
                  </p>
                </div>
              </div>
              {result.findings.length > 0 ? (
                <ul className="findingList">
                  {result.findings.map((finding) => (
                    <li key={finding.id}>
                      <div className="findingHeader">
                        <strong>{finding.title}</strong>
                        <span className="findingMeta">
                          <span className={`severityPill severity-${finding.severity}`}>
                            {finding.severity}
                          </span>
                          <span className={`confidencePill confidence-${finding.confidence}`}>
                            {finding.confidence}
                          </span>
                        </span>
                      </div>
                      <p>{finding.description}</p>
                      {finding.evidenceTruncated ? (
                        <p className="previewHint">
                          仅展示前 {finding.evidence.length} 条证据，共 {finding.evidenceTotal} 条。
                        </p>
                      ) : null}
                      <div className="evidenceList">
                        {finding.evidence.map((evidence) => (
                          <EvidenceItemView
                            key={evidence.eventId}
                            evidence={evidence}
                            chainId={result.meta.chainId}
                            watchedAddressSet={watchedAddressSet}
                          />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="emptyStateBlock emptyStatePositive">
                  <strong>没有明显关联信号</strong>
                  <p>当前分析器没有发现 watched 钱包之间的直接转账、共享 counterparty 或同合约交互。</p>
                </div>
              )}
            </section>

            <section className="resultPanel">
              <div className="resultHeader">
                <div>
                  <h2>Graph Edges</h2>
                  <p>
                    预览 {result.graph.edges.length} / {result.graph.totalEdges} normalized edges
                  </p>
                </div>
              </div>
              {result.graph.edgesTruncated ? (
                <p className="previewHint">大结果集已折叠为预览，后续我们可以接分页或图谱视图。</p>
              ) : null}
              {result.graph.edges.length > 0 ? (
                <ul className="edgeList">
                  {result.graph.edges.map((edge) => (
                    <EdgeRow
                      key={edge.id}
                      edge={edge}
                      chainId={result.meta.chainId}
                      watchedAddressSet={watchedAddressSet}
                      nodeById={nodeById}
                    />
                  ))}
                </ul>
              ) : (
                <div className="emptyStateBlock">
                  <strong>暂无边数据</strong>
                  <p>当前数据源没有生成可展示的关系边。</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </section>

    {result ? (
      <section className="resultPanel graphPanel">
        <div className="resultHeader">
          <div>
            <h2>关系图谱</h2>
            <p>
              {result.meta.graphWalletCount} wallets · {result.meta.graphContractCount} contracts · {result.graph.totalEdges} edges
            </p>
          </div>
        </div>
        <GraphExplorer
          chainId={result.meta.chainId}
          nodes={result.graph.nodes}
          edges={result.graph.edges}
          totalNodes={result.graph.totalNodes}
          totalEdges={result.graph.totalEdges}
          truncated={result.graph.nodesTruncated || result.graph.edgesTruncated}
        />
      </section>
    ) : null}
    </>
  );
}

interface EvidenceItemViewProps {
  evidence: EvidenceItem;
  chainId: number;
  watchedAddressSet: Set<string>;
}

function EvidenceItemView({ evidence, chainId, watchedAddressSet }: EvidenceItemViewProps) {
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
  const amountSymbol =
    event?.asset?.symbol ?? (isNativeAsset ? eventChain?.nativeSymbol : undefined);
  const eventTypeLabel = formatEventTypeLabel(event?.type);
  const relativeTime = formatRelativeTime(event?.timestamp);
  const absoluteTime = formatAbsoluteTime(event?.timestamp);

  return (
    <div className="evidenceItem">
      <div className="evidenceItemHeader">
        <span className={`eventTypePill event-${event?.type ?? "unknown"}`}>{eventTypeLabel}</span>
        {amountFormatted ? (
          <span className="amountChip">
            <strong>{amountFormatted}</strong>
            {amountSymbol ? <span>{amountSymbol}</span> : null}
          </span>
        ) : null}
        {event?.transferScope === "internal" ? (
          <span className="scopeChip" title="Internal call">
            internal
          </span>
        ) : null}
        {event?.asset?.tokenId ? (
          <span className="scopeChip" title="Token ID">
            #{event.asset.tokenId}
          </span>
        ) : null}
        {relativeTime ? (
          <span className="evidenceTime" title={absoluteTime}>
            {relativeTime}
          </span>
        ) : null}
      </div>
      <div className="evidenceItemBody">
        {event?.from ? (
          <AddressLink
            address={event.from}
            chainId={eventChainId}
            role="from"
            watchedAddressSet={watchedAddressSet}
          />
        ) : null}
        <span className="evidenceArrow" aria-hidden="true">
          →
        </span>
        {event?.to ? (
          <AddressLink
            address={event.to}
            chainId={eventChainId}
            role="to"
            watchedAddressSet={watchedAddressSet}
          />
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
          <a
            className="txLink"
            href={txHref}
            target="_blank"
            rel="noreferrer noopener"
            title={txHash}
          >
            <span aria-hidden="true">↗</span>
            <code>{shortenTxHash(txHash)}</code>
          </a>
        ) : (
          <code className="evidenceEventId" title={evidence.eventId}>
            {evidence.eventId}
          </code>
        )}
        {event?.asset?.contract && event.asset.kind !== "native" ? (
          <TokenLink
            chainId={eventChainId}
            contract={event.asset.contract}
            symbol={event.asset.symbol}
          />
        ) : null}
      </div>
    </div>
  );
}

interface AddressLinkProps {
  address: string;
  chainId: number;
  role: "from" | "to" | "contract" | "source" | "target";
  watchedAddressSet: Set<string>;
  label?: string;
  isContract?: boolean;
}

function AddressLink({
  address,
  chainId,
  role,
  watchedAddressSet,
  label,
  isContract,
}: AddressLinkProps) {
  const href = buildExplorerAddressUrl(chainId, address);
  const isWatched = watchedAddressSet.has(address.toLowerCase());
  const pillKind = isContract ? "contract" : isWatched ? "watched" : "observed";
  const roleLabel = label ?? (isContract ? "contract" : isWatched ? "watched" : "observed");

  return (
    <span className={`addressLink addressLink-${role} addressLink-${pillKind}`}>
      <span className="addressRoleTag">{roleLabel}</span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        title={address}
        className="addressValue"
      >
        {shortenAddress(address)}
      </a>
    </span>
  );
}

interface TokenLinkProps {
  chainId: number;
  contract: string;
  symbol?: string;
}

function TokenLink({ chainId, contract, symbol }: TokenLinkProps) {
  const href = buildExplorerTokenUrl(chainId, contract);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="tokenChip"
      title={contract}
    >
      {symbol ?? "token"} <span aria-hidden="true">↗</span>
    </a>
  );
}

interface EdgeRowProps {
  edge: GraphEdge;
  chainId: number;
  watchedAddressSet: Set<string>;
  nodeById: Map<string, GraphNode>;
}

function EdgeRow({ edge, chainId, watchedAddressSet, nodeById }: EdgeRowProps) {
  const sourceNode = nodeById.get(edge.source);
  const targetNode = nodeById.get(edge.target);
  const edgeChainId = edge.metadata?.chainId ?? chainId;
  const txHash = edge.metadata?.txHash;
  const txHref = txHash ? buildExplorerTxUrl(edgeChainId, txHash) : undefined;
  const isAssetNative = edge.metadata?.asset?.kind === "native";
  const edgeChain = getSupportedAnalysisChain(edgeChainId);
  const amountDecimals = isAssetNative
    ? edgeChain?.nativeDecimals ?? 18
    : edge.metadata?.asset?.decimals;
  const canRenderAmount =
    edge.metadata?.amount !== undefined &&
    edge.metadata.amount !== "" &&
    (isAssetNative || edge.metadata?.asset?.decimals !== undefined);
  const amountFormatted = canRenderAmount
    ? formatAmount(edge.metadata?.amount, amountDecimals)
    : undefined;
  const amountSymbol =
    edge.metadata?.asset?.symbol ?? (isAssetNative ? edgeChain?.nativeSymbol : undefined);

  return (
    <li className="edgeRow">
      <span className={`edgeKindPill edge-${edge.kind}`}>{formatEdgeKindLabel(edge.kind)}</span>
      <div className="edgeNodes">
        <GraphNodeLink
          node={sourceNode}
          chainId={edgeChainId}
          fallbackId={edge.source}
          watchedAddressSet={watchedAddressSet}
        />
        <span className="evidenceArrow" aria-hidden="true">
          →
        </span>
        <GraphNodeLink
          node={targetNode}
          chainId={edgeChainId}
          fallbackId={edge.target}
          watchedAddressSet={watchedAddressSet}
        />
      </div>
      <div className="edgeMeta">
        {amountFormatted ? (
          <span className="amountChip">
            <strong>{amountFormatted}</strong>
            {amountSymbol ? <span>{amountSymbol}</span> : null}
          </span>
        ) : null}
        {edge.metadata?.methodId ? (
          <code className="methodChip" title="Method selector">
            {edge.metadata.methodId}
          </code>
        ) : null}
        {txHash ? (
          <a
            className="txLink"
            href={txHref}
            target="_blank"
            rel="noreferrer noopener"
            title={txHash}
          >
            <span aria-hidden="true">↗</span>
            <code>{shortenTxHash(txHash)}</code>
          </a>
        ) : null}
      </div>
    </li>
  );
}

interface GraphNodeLinkProps {
  node: GraphNode | undefined;
  chainId: number;
  fallbackId: string;
  watchedAddressSet: Set<string>;
}

function GraphNodeLink({ node, chainId, fallbackId, watchedAddressSet }: GraphNodeLinkProps) {
  if (!node || !node.address) {
    return <code className="evidenceEventId" title={fallbackId}>{shortenAddress(fallbackId)}</code>;
  }

  const isContract = node.kind === "contract";
  const isWatched = node.tags?.includes("watched") ?? watchedAddressSet.has(node.address.toLowerCase());

  return (
    <AddressLink
      address={node.address}
      chainId={chainId}
      role={isContract ? "contract" : "source"}
      watchedAddressSet={watchedAddressSet}
      label={isContract ? "contract" : isWatched ? "watched" : "observed"}
      isContract={isContract}
    />
  );
}

function formatFetchTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function LoadingResult() {
  return (
    <div className="loadingStack" aria-label="分析任务运行中">
      <div className="skeletonBlock skeletonTall" />
      <div className="skeletonGrid">
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
      </div>
      <div className="skeletonLine" />
    </div>
  );
}

function LoadingList() {
  return (
    <div className="loadingStack">
      <div className="skeletonBlock" />
      <div className="skeletonBlock" />
      <div className="skeletonBlock" />
    </div>
  );
}
