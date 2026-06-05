"use client";

import { PdfReportExporter } from "@wallet-map/exporters";
import {
  Activity,
  ClipboardList,
  Database,
  FileText,
  Globe2,
  Layers3,
  Play,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  evmAggregateChainId,
  getEvmAggregateChains,
} from "../../app/chains";
import { AnalysisEvidencePanel } from "./analysis-evidence-panel";
import {
  describeFindingGroup,
  formatConfidenceLabel,
  formatSkippedChainSummary,
  formatVerdictLabel,
} from "./analysis-formatters";
import { AnalysisProgress } from "./analysis-progress";
import { buildAnalysisReport } from "./analysis-report";
import type {
  AnalysisJobPollResponse,
  AnalysisJobProgress,
  AnalysisJobStartResponse,
  AnalysisResponse,
  AnalysisWorkbenchProps,
  GraphEdge,
  GraphNode,
} from "./analysis-types";
import { GraphExplorer } from "../graph/graph-explorer";

const sampleAddresses = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "0xdddddddddddddddddddddddddddddddddddddddd",
].join("\n");

const activeAnalysisJobStorageKey = "wallet-map:active-analysis-job";

const dataModeOptions = [
  { value: "auto", label: "Auto", description: "自动选择" },
  { value: "fixture", label: "Fixture", description: "本地样本" },
  { value: "live", label: "Live", description: "实时数据" },
] as const;

const dataProviderOptions = [
  { value: "auto", label: "Auto", description: "优先 NodeReal" },
  { value: "nodereal", label: "NodeReal", description: "强制 NodeReal" },
  { value: "etherscan", label: "Etherscan", description: "强制 Etherscan V2" },
  { value: "solscan", label: "Solscan", description: "Solana 专用" },
] as const;

function readActiveAnalysisJobId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(activeAnalysisJobStorageKey);
  } catch {
    return null;
  }
}

function rememberActiveAnalysisJob(jobId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(activeAnalysisJobStorageKey, jobId);
  } catch {
    // Browsers can block storage; analysis still works without resumability.
  }
}

function forgetActiveAnalysisJob(jobId: string | null): void {
  if (typeof window === "undefined" || !jobId) {
    return;
  }

  try {
    if (window.sessionStorage.getItem(activeAnalysisJobStorageKey) === jobId) {
      window.sessionStorage.removeItem(activeAnalysisJobStorageKey);
    }
  } catch {
    // Ignore blocked storage.
  }
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
  const [dataProvider, setDataProvider] = useState("auto");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [jobProgress, setJobProgress] = useState<AnalysisJobProgress | null>(null);
  const [evidenceTab, setEvidenceTab] = useState<"findings" | "edges">("findings");
  const [openFindingGroups, setOpenFindingGroups] = useState<Record<string, boolean>>({});
  const [openEdgeGroups, setOpenEdgeGroups] = useState<Record<string, boolean>>({});
  const [isInputScrolling, setIsInputScrolling] = useState(false);
  const [isEvidenceScrolling, setIsEvidenceScrolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputScrollTimerRef = useRef<number | null>(null);
  const evidenceScrollTimerRef = useRef<number | null>(null);
  const restoredJobIdRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const evmAggregateChains = useMemo(() => getEvmAggregateChains(), []);
  const effectiveChainIds = useMemo(
    () =>
      chainId === String(evmAggregateChainId)
        ? evmAggregateChains.map((chain) => chain.chainId)
        : [Number(chainId)],
    [chainId, evmAggregateChains],
  );
  const addressCount = useMemo(
    () => addresses.split(/\s+/).filter((address) => address.trim().length > 0).length,
    [addresses],
  );
  const selectedChain = useMemo(
    () =>
      chainId === String(evmAggregateChainId)
        ? undefined
        : (supportedChains.find((chain) => String(chain.chainId) === chainId) ?? supportedChains[0]),
    [chainId, supportedChains],
  );
  const inputScopeLabel = useMemo(
    () => (chainId === String(evmAggregateChainId) ? "EVM ALL" : selectedChain?.shortName ?? "Chain"),
    [chainId, selectedChain],
  );
  const inputScopeSummary = useMemo(
    () => `${inputScopeLabel} · ${addressCount} addresses`,
    [addressCount, inputScopeLabel],
  );
  const submitScopeSummary = useMemo(
    () => `${inputScopeLabel} · ${addressCount} 地址`,
    [addressCount, inputScopeLabel],
  );
  const submitStatusHint = isRunning
    ? "正在按阶段处理链上数据和标签"
    : "确认配置后生成关系分析任务";
  const modeDescription = useMemo(() => {
    if (dataMode === "live") {
      return liveConfigured
        ? "直接拉取所选 provider 的实时数据。"
        : "当前会请求实时数据；如果本地还没加载 key，这次运行会直接报错。";
    }

    if (dataMode === "fixture") {
      return "固定使用本地 fixture 数据，适合演示和回归测试。";
    }

    return liveConfigured
      ? "优先走实时数据；Auto provider 会先试 NodeReal，再按链使用备用 provider。"
      : "当前会自动回退到 fixture，直到本地环境加载了 API key。";
  }, [dataMode, liveConfigured]);

  useEffect(() => {
    const replayJobId = searchParams.get("job");
    const activeJobId = replayJobId ?? readActiveAnalysisJobId();

    if (!activeJobId || restoredJobIdRef.current === activeJobId) {
      return;
    }

    restoredJobIdRef.current = activeJobId;
    void loadAnalysisJob(activeJobId);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (inputScrollTimerRef.current) {
        window.clearTimeout(inputScrollTimerRef.current);
      }
      if (evidenceScrollTimerRef.current) {
        window.clearTimeout(evidenceScrollTimerRef.current);
      }
    };
  }, []);

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

  const graphNodeIndex = useMemo(() => {
    if (!result) {
      return new Map<string, GraphNode>();
    }

    return new Map(result.graph.nodes.map((node) => [node.id, node]));
  }, [result]);

  const groupedFindings = useMemo(() => {
    if (!result) {
      return [];
    }

    const groups = new Map<
      string,
      {
        title: string;
        summary: string;
        findings: AnalysisResponse["findings"];
      }
    >();

    for (const finding of result.findings) {
      const current = groups.get(finding.title) ?? {
        title: finding.title,
        summary: "",
        findings: [],
      };
      current.findings.push(finding);
      current.summary = describeFindingGroup(finding.title, current.findings.length);
      groups.set(finding.title, current);
    }

    return Array.from(groups.values()).sort((left, right) => right.findings.length - left.findings.length);
  }, [result]);

  const groupedEdges = useMemo(() => {
    if (!result) {
      return [];
    }

    const groups = new Map<
      GraphEdge["kind"],
      {
        kind: GraphEdge["kind"];
        edges: GraphEdge[];
      }
    >();

    for (const edge of result.graph.edges) {
      const current = groups.get(edge.kind) ?? {
        kind: edge.kind,
        edges: [],
      };
      current.edges.push(edge);
      groups.set(edge.kind, current);
    }

    return Array.from(groups.values()).sort((left, right) => right.edges.length - left.edges.length);
  }, [result]);

  async function loadAnalysisJob(jobId: string) {
    setError(null);

    try {
      const response = await fetch(`/api/analyze/jobs/${jobId}`);
      const body = (await response.json()) as AnalysisJobPollResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Failed to load saved analysis.");
      }

      const poll = body as AnalysisJobPollResponse;
      setJobProgress(poll.progress);

      if (poll.status === "completed" && poll.result) {
        rememberActiveAnalysisJob(jobId);
        setResult(poll.result);
        setIsRunning(false);
        setJobProgress(null);
        return;
      }

      if (poll.status === "failed") {
        forgetActiveAnalysisJob(jobId);
        throw new Error(poll.error ?? "Analysis failed.");
      }

      const controller = new AbortController();
      setIsRunning(true);
      setResult(null);
      setEvidenceTab("findings");
      const analysisResult = await pollAnalyzeJob(jobId, controller.signal);
      rememberActiveAnalysisJob(jobId);
      setResult(analysisResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load saved analysis.");
    } finally {
      setIsRunning(false);
      setJobProgress(null);
    }
  }

  async function pollAnalyzeJob(jobId: string, signal: AbortSignal): Promise<AnalysisResponse> {
    while (!signal.aborted) {
      const response = await fetch(`/api/analyze/jobs/${jobId}`, { signal });
      const body = (await response.json()) as AnalysisJobPollResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Failed to poll analysis job.");
      }

      const poll = body as AnalysisJobPollResponse;
      setJobProgress(poll.progress);

      if (poll.status === "completed" && poll.result) {
        return poll.result;
      }

      if (poll.status === "failed") {
        throw new Error(poll.error ?? "Analysis failed.");
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    throw new Error("Analysis cancelled.");
  }

  async function runAnalysis() {
    setIsRunning(true);
    setJobProgress(null);
    setError(null);
    setResult(null);
    setEvidenceTab("findings");
    setOpenFindingGroups({});
    setOpenEdgeGroups({});

    const controller = new AbortController();
    let jobId: string | null = null;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addresses,
          chainId: Number(chainId),
          chainIds: effectiveChainIds,
          dataMode,
          dataProvider,
        }),
        signal: controller.signal,
      });
      const body = (await response.json()) as AnalysisJobStartResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Analysis failed.");
      }

      if (!("jobId" in body) || !body.jobId) {
        throw new Error("Analysis job was not created.");
      }

      jobId = body.jobId;
      restoredJobIdRef.current = body.jobId;
      rememberActiveAnalysisJob(body.jobId);

      const analysisResult = await pollAnalyzeJob(body.jobId, controller.signal);
      setResult(analysisResult);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") {
        return;
      }

      forgetActiveAnalysisJob(jobId);
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsRunning(false);
      setJobProgress(null);
    }
  }

  async function importAddressFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const text = await file.text();
    const imported = text
      .split(/[\s,;\n\r]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n");

    setAddresses(imported);
  }

  async function downloadPdfReport() {
    if (!result) {
      return;
    }

    const report = await new PdfReportExporter().export(buildAnalysisReport(result));
    const url = URL.createObjectURL(report);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wallet-map-${new Date(result.meta.fetchedAt).toISOString().slice(0, 10)}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleInputScroll() {
    setIsInputScrolling(true);

    if (inputScrollTimerRef.current) {
      window.clearTimeout(inputScrollTimerRef.current);
    }

    inputScrollTimerRef.current = window.setTimeout(() => {
      setIsInputScrolling(false);
    }, 700);
  }

  function handleEvidenceScroll() {
    setIsEvidenceScrolling(true);

    if (evidenceScrollTimerRef.current) {
      window.clearTimeout(evidenceScrollTimerRef.current);
    }

    evidenceScrollTimerRef.current = window.setTimeout(() => {
      setIsEvidenceScrolling(false);
    }, 700);
  }

  function isFindingGroupOpen(title: string, index: number) {
    return openFindingGroups[title] ?? index === 0;
  }

  function toggleFindingGroup(title: string, index: number) {
    setOpenFindingGroups((current) => ({
      ...current,
      [title]: !(current[title] ?? index === 0),
    }));
  }

  function isEdgeGroupOpen(kind: GraphEdge["kind"], index: number) {
    return openEdgeGroups[kind] ?? index === 0;
  }

  function toggleEdgeGroup(kind: GraphEdge["kind"], index: number) {
    setOpenEdgeGroups((current) => ({
      ...current,
      [kind]: !(current[kind] ?? index === 0),
    }));
  }

  return (
    <section className="workbench" aria-label="Wallet Map workbench">
      <aside className="workbenchColumn workbenchInput">
        <div
          className={`workbenchInputBody ${isInputScrolling ? "workbenchInputScrolling" : ""}`}
          onScroll={handleInputScroll}
        >
        <form
          id="analysis-input-form"
          className="inputPanel"
          onSubmit={(event) => {
            event.preventDefault();
            void runAnalysis();
          }}
        >
          <div className="panelHeader">
            <div>
              <span className="panelEyebrow">Analysis job</span>
              <h2>分析输入</h2>
              <p className="panelHeaderSummary quickTooltip" data-tooltip={inputScopeSummary}>
                <span className="panelHeaderSummaryText">{inputScopeSummary}</span>
              </p>
            </div>
            <div className="panelHeaderActions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.tsv"
                hidden
                onChange={(event) => {
                  void importAddressFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className="secondaryButton"
                disabled={isRunning}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} strokeWidth={2.1} />
                批量导入
              </button>
            </div>
          </div>
          <div className="fieldGroup">
            <label htmlFor="addresses">钱包地址</label>
            <textarea
              id="addresses"
              name="addresses"
              disabled={isRunning}
              onChange={(event) => setAddresses(event.target.value)}
              placeholder={"0x...\n0x...\n0x..."}
              rows={6}
              value={addresses}
            />
            <p>每行、空格或 CSV 分隔一个地址；EVM 聚合会跨主流 L1/L2 同时分析这些 watched wallets。</p>
          </div>
          <div className="inlineActionRow">
            <button
              type="button"
              className="secondaryButton"
              disabled={isRunning}
              onClick={() => setAddresses(defaultAddresses)}
            >
              <ClipboardList size={15} strokeWidth={2.1} />
              填入示例
            </button>
          </div>
          <div
            className={`stateBanner ${liveConfigured ? "stateBannerSuccess" : "stateBannerInfo"}`}
            aria-live="polite"
          >
            <strong>{liveConfigured ? "实时数据已就绪" : "当前默认走本地 fixture"}</strong>
            <span>{modeDescription}</span>
          </div>
          <div className="controlStack">
            <div className="controlGroup controlCard">
              <div className="controlLabelRow">
                <span>
                  <Layers3 size={15} strokeWidth={2.2} />
                  链
                </span>
                <small>{selectedChain?.explorerName ?? "Explorer"}</small>
              </div>
              <div className="segmentedControl segmentedControlChains" role="radiogroup" aria-label="选择链">
                <button
                  type="button"
                  className={`segmentedButton ${chainId === String(evmAggregateChainId) ? "segmentedButtonActive" : ""}`}
                  disabled={isRunning}
                  onClick={() => {
                    setChainId(String(evmAggregateChainId));
                    if (dataProvider === "solscan") {
                      setDataProvider("auto");
                    }
                  }}
                  role="radio"
                  aria-checked={chainId === String(evmAggregateChainId)}
                  title="跨 Ethereum、Arbitrum、Base、Optimism、Polygon、BSC 聚合分析"
                >
                  <small>EVM</small>
                  <span>EVM ALL</span>
                </button>
                {supportedChains.map((chain) => (
                  <button
                    key={chain.chainId}
                    type="button"
                    className={`segmentedButton ${String(chain.chainId) === chainId ? "segmentedButtonActive" : ""}`}
                    disabled={isRunning}
                    onClick={() => {
                      setChainId(String(chain.chainId));
                      if (chain.ecosystem === "solana") {
                        setDataProvider("solscan");
                      } else if (dataProvider === "solscan") {
                        setDataProvider("auto");
                      }
                    }}
                    role="radio"
                    aria-checked={String(chain.chainId) === chainId}
                  >
                    <small>{chain.ecosystem === "solana" ? "SVM" : "EVM"}</small>
                    <span>{chain.shortName}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="controlGroup controlCard">
              <div className="controlLabelRow">
                <span>
                  <Globe2 size={15} strokeWidth={2.2} />
                  Provider
                </span>
                <small>{dataProviderOptions.find((option) => option.value === dataProvider)?.description}</small>
              </div>
              <div className="segmentedControl segmentedControlModes" role="radiogroup" aria-label="选择 provider">
                {dataProviderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmentedButton ${dataProvider === option.value ? "segmentedButtonActive" : ""}`}
                    disabled={isRunning}
                    onClick={() => setDataProvider(option.value)}
                    role="radio"
                    aria-checked={dataProvider === option.value}
                    title={option.description}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="controlGroup controlCard">
              <div className="controlLabelRow">
                <span>
                  <Database size={15} strokeWidth={2.2} />
                  数据源
                </span>
                <small>{dataMode === "live" ? "强制实时" : dataMode === "fixture" ? "固定样本" : "智能选择"}</small>
              </div>
              <div className="segmentedControl segmentedControlModes" role="radiogroup" aria-label="选择数据源">
                {dataModeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmentedButton ${dataMode === option.value ? "segmentedButtonActive" : ""}`}
                    disabled={isRunning}
                    onClick={() => setDataMode(option.value)}
                    role="radio"
                    aria-checked={dataMode === option.value}
                    title={option.description}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        <section className="resultPanel summaryPanel">
          <div className="resultHeader">
            <div>
              <span className="panelEyebrow">Relationship verdict</span>
              <h2>分析摘要</h2>
              <p>
                {result
                  ? result.sourceLabel ??
                    `${result.meta.chainName} · ${
                      result.meta.resolvedMode === "live" ? "Live" : "Fixture"
                    }`
                  : "等待任务运行"}
              </p>
            </div>
            {result ? (
              <div className="resultHeaderActions">
                <button type="button" className="secondaryButton reportButtonInline" onClick={() => void downloadPdfReport()}>
                  <FileText size={15} strokeWidth={2.1} />
                  PDF 报告
                </button>
                <span className="statusPill statusSuccess">Complete</span>
              </div>
            ) : null}
            {isRunning ? <span className="statusPill statusRunning">Running</span> : null}
          </div>
          {isRunning ? (
            <div className="emptyStateBlock emptyStateRunning">
              <strong>任务正在运行</strong>
              <p>主画布会展示后端实时阶段进度；分析完成后这里会显示评分、钱包对洞察和信号摘要。</p>
            </div>
          ) : result && graphSummary ? (
            <>
              <div className="scoreRow">
                <div>
                  <span><ShieldCheck size={14} strokeWidth={2.1} /> Score</span>
                  <strong>{result.score.score}/100</strong>
                </div>
                <div>
                  <span><Activity size={14} strokeWidth={2.1} /> Confidence</span>
                  <strong>{result.score.confidence}</strong>
                </div>
              </div>
              {result.meta.fallbackReason ? (
                <div className="stateBanner stateBannerInfo">
                  <strong>本次用了 fixture 回退</strong>
                  <span>{result.meta.fallbackReason}</span>
                </div>
              ) : null}
              {result.meta.warnings?.length ? (
                <div className="stateBanner stateBannerWarning">
                  <strong>部分链已跳过</strong>
                  <span>{formatSkippedChainSummary(result.meta.warnings)}</span>
                  <details className="warningDetails">
                    <summary>查看详情</summary>
                    <ul>
                      {result.meta.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              ) : null}
              {result.summary.verdict !== "none" ? (
                <>
                  <div className={`verdictCard verdict-${result.summary.verdict}`}>
                    <div className="verdictHeader">
                      <span className={`verdictPill verdictPill-${result.summary.verdict}`}>
                        <Sparkles size={14} strokeWidth={2.1} />
                        {formatVerdictLabel(result.summary.verdict)}
                      </span>
                      <span className="verdictSubtle">{result.summary.pairInsights.length} 个钱包对命中关联规则</span>
                    </div>
                    <strong>{result.summary.headline}</strong>
                    <p className="verdictNarrative">{result.summary.narrative}</p>
                  </div>
                  <div className="pairInsightList">
                    {result.summary.pairInsights.slice(0, 3).map((pair) => (
                      <div key={pair.id} className="pairInsightCard">
                        <div className="pairInsightHeader">
                          <strong>{pair.labels.join(" ↔ ")}</strong>
                          <span className={`verdictPill verdictPill-${pair.strength}`}>
                            <Sparkles size={13} strokeWidth={2.1} />
                            {formatVerdictLabel(pair.strength)}
                          </span>
                        </div>
                        <p>{pair.reasons.join(" · ")}</p>
                        <div className="pairInsightMeta">
                          <span>{pair.signalCount} 个信号</span>
                          <span>{formatVerdictLabel(pair.strength)}结论</span>
                          <span>{formatConfidenceLabel(pair.confidence)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {result.summary.signalHighlights.length > 0 ? (
                    <div className="signalSummaryCard">
                      <strong>命中信号分组</strong>
                      <ul className="reasonList">
                        {result.summary.signalHighlights.map((signal) => (
                          <li key={`${signal.analyzerId}:${signal.title}`}>
                            {signal.title} · {signal.count}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="emptyStateBlock emptyStatePositive">
                  <strong>没有命中任何关联规则</strong>
                  <p>当前分析器没有发现 watched 钱包之间的直接或间接关联。</p>
                </div>
              )}
              <div className="metricGrid">
                <div>
                  <span><WalletCards size={14} strokeWidth={2.1} /> Watched</span>
                  <strong>{result.meta.watchedAddressCount}</strong>
                </div>
                <div>
                  <span><Database size={14} strokeWidth={2.1} /> Events</span>
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
            </>
          ) : (
            <div className="emptyStateBlock">
              <strong>还没有分析结果</strong>
              <p>运行一次分析后，这里会显示评分、置信度和图谱摘要。</p>
            </div>
          )}
        </section>
        </div>

        <div className="analysisSubmitDock" aria-live="polite">
          {error ? (
            <div className="stateBanner stateBannerError analysisSubmitError" role="alert">
              <strong>分析失败</strong>
              <span>{error}</span>
            </div>
          ) : null}
          <div className="analysisSubmitBar">
            <div className="analysisSubmitMeta">
              <strong className="quickTooltip" data-tooltip={submitScopeSummary}>
                <span className="analysisSubmitMetaLine">{submitScopeSummary}</span>
              </strong>
              <span className="quickTooltip" data-tooltip={submitStatusHint}>
                <span className="analysisSubmitMetaLine">{submitStatusHint}</span>
              </span>
            </div>
            <button
              type="submit"
              form="analysis-input-form"
              className="primaryButton primaryButtonCompact analysisSubmitButton"
              disabled={isRunning}
            >
              {isRunning ? <span className="buttonSpinner" aria-hidden="true" /> : <Play size={15} strokeWidth={2.4} />}
              {isRunning ? "分析中..." : "生成分析任务"}
            </button>
          </div>
        </div>
      </aside>

      <section className="workbenchColumn workbenchGraph">
        <header className="workbenchColumnHeader">
          <div>
            <h2>关系图谱</h2>
            <p>
              {result
                ? `${result.meta.graphWalletCount} wallets · ${result.meta.graphContractCount} contracts · ${result.graph.totalEdges} 条关联边`
                : "仅展示命中分析器的关联子图 · 点击节点查看解释"}
            </p>
          </div>
        </header>
        <div className="workbenchGraphBody">
          {isRunning ? (
            <div className="graphLoadingState" aria-live="polite">
              <AnalysisProgress
                progress={jobProgress}
                chainName={chainId === String(evmAggregateChainId) ? "EVM ALL" : selectedChain?.shortName ?? "Chain"}
                addressCount={addressCount}
                variant="hero"
              />
            </div>
          ) : result && result.graph.totalEdges > 0 ? (
            <GraphExplorer
              chainId={result.meta.chainId}
              nodes={result.graph.nodes}
              edges={result.graph.edges}
              totalNodes={result.graph.totalNodes}
              totalEdges={result.graph.totalEdges}
              truncated={result.graph.nodesTruncated || result.graph.edgesTruncated}
            />
          ) : (
            <div className="graphPlaceholder">
              <div className="graphPlaceholderIcon" aria-hidden="true">
                <Activity size={26} strokeWidth={2.1} />
              </div>
              <strong>{result ? "当前没有形成关联子图" : "提交一次分析就能看到图谱"}</strong>
              <p>
                {result
                  ? "现有分析器没有命中可以归因为钱包关联的边，所以图谱区域保持为空。"
                  : "左侧填入钱包地址、选择链和数据源，然后点击 “生成分析任务”。"}
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="workbenchColumn workbenchFindings">
        <header className="workbenchColumnHeader workbenchFindingsHeader">
          <div className="workbenchFindingsTitle">
            <div className="panelTabs" role="tablist" aria-label="Evidence panels">
              <button
                type="button"
                role="tab"
                aria-selected={evidenceTab === "findings"}
                className={`panelTab ${evidenceTab === "findings" ? "panelTabActive" : ""}`}
                onClick={() => setEvidenceTab("findings")}
              >
                Findings
                {result ? <span className="panelTabCount">{result.findings.length}</span> : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={evidenceTab === "edges"}
                className={`panelTab ${evidenceTab === "edges" ? "panelTabActive" : ""}`}
                onClick={() => setEvidenceTab("edges")}
              >
                Related Edges
                {result ? <span className="panelTabCount">{result.graph.totalEdges}</span> : null}
              </button>
            </div>
            <p>
              {result
                ? evidenceTab === "findings"
                  ? `${result.meta.chainName} · 分析器信号`
                  : `${result.graph.totalEdges} 条已命中的关联边`
                : "分析器证据流"}
            </p>
          </div>
        </header>
        <div
          className={`workbenchScroll ${isEvidenceScrolling ? "workbenchScrollScrolling" : ""}`}
          onScroll={handleEvidenceScroll}
        >
          <AnalysisEvidencePanel
            result={result}
            isRunning={isRunning}
            evidenceTab={evidenceTab}
            groupedFindings={groupedFindings}
            groupedEdges={groupedEdges}
            watchedAddressSet={watchedAddressSet}
            graphNodeIndex={graphNodeIndex}
            isFindingGroupOpen={isFindingGroupOpen}
            toggleFindingGroup={toggleFindingGroup}
            isEdgeGroupOpen={isEdgeGroupOpen}
            toggleEdgeGroup={toggleEdgeGroup}
          />
        </div>
      </aside>
    </section>
  );
}
