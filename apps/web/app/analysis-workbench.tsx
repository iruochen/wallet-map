"use client";

import { useMemo, useState } from "react";

const sampleAddresses = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "0xdddddddddddddddddddddddddddddddddddddddd",
].join("\n");

interface AnalysisResponse {
  mode: "fixture" | "live";
  source: string;
  score: {
    score: number;
    confidence: "low" | "medium" | "high";
    reasons: string[];
    counterEvidence: string[];
  };
  graph: {
    nodes: Array<{ id: string; kind: string; label?: string; tags?: string[] }>;
    edges: Array<{
      id: string;
      kind: string;
      source: string;
      target: string;
      evidenceEventIds: string[];
    }>;
  };
  findings: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    confidence: string;
    evidence: Array<{ eventId: string; txHash?: string; summary: string }>;
  }>;
}

export function AnalysisWorkbench() {
  const [addresses, setAddresses] = useState(sampleAddresses);
  const [chainId, setChainId] = useState("1");
  const [dataMode, setDataMode] = useState("auto");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const addressCount = useMemo(
    () => addresses.split(/\s+/).filter((address) => address.trim().length > 0).length,
    [addresses],
  );
  const graphSummary = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      wallets: result.graph.nodes.filter((node) => node.kind === "wallet").length,
      contracts: result.graph.nodes.filter((node) => node.kind === "contract").length,
      edges: result.graph.edges.length,
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
            <p>
              {dataMode === "auto" ? "Auto mode" : `${dataMode} mode`} · {addressCount} addresses
            </p>
          </div>
          <button
            type="button"
            className="secondaryButton"
            disabled={isRunning}
            onClick={() => setAddresses(sampleAddresses)}
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
        <div className="formRow">
          <label>
            链
            <select
              disabled={isRunning}
              name="chainId"
              onChange={(event) => setChainId(event.target.value)}
              value={chainId}
            >
              <option value="1">Ethereum</option>
              <option value="42161">Arbitrum</option>
              <option value="8453">Base</option>
              <option value="56">BSC</option>
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
              <p>{result ? `${result.mode} · ${result.source}` : "等待任务运行"}</p>
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
              {result.score.reasons.length > 0 ? (
                <ul className="reasonList">
                  {result.score.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              <div className="metricGrid">
                <div>
                  <span>Wallets</span>
                  <strong>{graphSummary.wallets}</strong>
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
              <p className="sourceLine">
                Source: <code>{result.source}</code>
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
                  <p>{result.findings.length} signals</p>
                </div>
              </div>
              {result.findings.length > 0 ? (
                <ul className="findingList">
                  {result.findings.map((finding) => (
                    <li key={finding.id}>
                      <div>
                        <strong>{finding.title}</strong>
                        <span>
                          {finding.severity} / {finding.confidence}
                        </span>
                      </div>
                      <p>{finding.description}</p>
                      <div className="evidenceList">
                        {finding.evidence.map((evidence) => (
                          <code key={evidence.eventId}>{evidence.txHash ?? evidence.eventId}</code>
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
                  <p>{result.graph.edges.length} normalized edges</p>
                </div>
              </div>
              {result.graph.edges.length > 0 ? (
                <ul className="edgeList">
                  {result.graph.edges.map((edge) => (
                    <li key={edge.id}>
                      <span>{edge.kind}</span>
                      <code>{edge.source}</code>
                      <code>{edge.target}</code>
                    </li>
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
  );
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
