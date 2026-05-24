"use client";

import { useMemo, useState } from "react";

const sampleAddresses = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
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
      <form className="inputPanel">
        <div className="panelHeader">
          <div>
            <h2>分析输入</h2>
            <p>{dataMode === "auto" ? "Auto mode" : `${dataMode} mode`}</p>
          </div>
          <button type="button" className="secondaryButton" onClick={() => setAddresses(sampleAddresses)}>
            填入示例
          </button>
        </div>
        <label htmlFor="addresses">钱包地址</label>
        <textarea
          id="addresses"
          name="addresses"
          onChange={(event) => setAddresses(event.target.value)}
          placeholder={"0x...\n0x...\n0x..."}
          rows={8}
          value={addresses}
        />
        <div className="formRow">
          <label>
            链
            <select name="chainId" onChange={(event) => setChainId(event.target.value)} value={chainId}>
              <option value="1">Ethereum</option>
              <option value="42161">Arbitrum</option>
              <option value="8453">Base</option>
              <option value="56">BSC</option>
            </select>
          </label>
          <label>
            数据源
            <select
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
        <button type="button" disabled={isRunning} onClick={runAnalysis}>
          {isRunning ? "分析中" : "生成分析任务"}
        </button>
        {error ? <p className="errorText">{error}</p> : null}
      </form>

      <div className="resultsColumn">
        <section className="resultPanel">
          <h2>分析结果</h2>
          {result && graphSummary ? (
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
            <p className="emptyState">运行一次分析后，这里会显示评分和图谱摘要。</p>
          )}
        </section>

        {result ? (
          <>
            <section className="resultPanel">
              <h2>Findings</h2>
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
                      {finding.evidence.map((evidence) => (
                        <code key={evidence.eventId}>{evidence.txHash ?? evidence.eventId}</code>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="emptyState">没有发现 watched 钱包之间的直接转账。</p>
              )}
            </section>

            <section className="resultPanel">
              <h2>Graph Edges</h2>
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
                <p className="emptyState">当前 fixture 没有生成边。</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
