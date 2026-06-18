"use client";

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
} from "../../../app/chains";
import { readJsonResponse } from "../../../lib/read-json-response";
import { useI18n } from "../../i18n/i18n-provider";
import { AnalysisEvidencePanel } from "../evidence/analysis-evidence-panel";
import { FindingHelpTip } from "../evidence/finding-help-tip";
import { parseAddressImport, type AddressImportSummary } from "../lib/address-import";
import {
  describeFindingGroup,
  formatSkippedChainDetails,
  formatSkippedChainSummary,
  formatVerdictLabel,
} from "../lib/formatters";
import { deriveWorkbenchInputFromResult } from "../lib/input-restore";
import {
  defaultHistoryScopeSelection,
  historyScopeOptionDefinitions,
  parseHistoryScopeSelection,
  resolveHistoryScopeSelection,
} from "../lib/history-scope-options";
import {
  clearWorkbenchJobUrl,
  forgetActiveAnalysisJob,
  readActiveAnalysisJobId,
  rememberActiveAnalysisJob,
} from "../lib/active-job-restore";
import { downloadAnalysisReport } from "../lib/report-download";
import type {
  AnalysisJobPollResponse,
  AnalysisJobProgress,
  AnalysisJobStartResponse,
  AnalysisResponse,
  AnalysisWorkbenchProps,
  GraphEdge,
  GraphNode,
} from "../types";
import { saveSessionHistoryJob } from "../../history/lib/session-history";
import { GraphExplorer } from "../../graph/graph-explorer";
import { AnalysisProgress } from "./analysis-progress";
import { AddressInputComposer } from "./address-input-composer";
import { ExposureScoreDimensions } from "./analysis-score-dimensions";
import { PairInsightCard } from "../evidence/pair-insight-card";
import { WorkbenchMobileTabs, type WorkbenchMobilePanel } from "./workbench-mobile-tabs";

const sampleAddresses = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "0xdddddddddddddddddddddddddddddddddddddddd",
].join("\n");

const evidenceHintDismissedStorageKey = "wallet-map:evidence-hint-dismissed-jobs";
const activeAnalysisJobRestoreAttempts = 3;
const activeAnalysisJobRestoreDelayMs = 500;

type DataModeOptionValue = "auto" | "fixture" | "live";
type DataProviderOptionValue = "auto" | "nodereal" | "etherscan" | "solscan";

function readDismissedEvidenceHintJobIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.sessionStorage.getItem(evidenceHintDismissedStorageKey);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((entry): entry is string => typeof entry === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function rememberDismissedEvidenceHint(jobId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const dismissed = readDismissedEvidenceHintJobIds();
    dismissed.add(jobId);
    window.sessionStorage.setItem(evidenceHintDismissedStorageKey, JSON.stringify([...dismissed]));
  } catch {
    // Ignore blocked storage.
  }
}

function shouldShowEvidenceHint(jobId: string): boolean {
  return !readDismissedEvidenceHintJobIds().has(jobId);
}

export function AnalysisWorkbench({
  liveConfigured,
  supportedChains,
  initialAddresses,
  anonymousAnalysisQuota,
}: AnalysisWorkbenchProps) {
  const { t, locale } = useI18n();
  const defaultAddresses = initialAddresses?.trim() ? initialAddresses : sampleAddresses;
  const [addresses, setAddresses] = useState(defaultAddresses);
  const [chainId, setChainId] = useState("1");
  const [dataMode, setDataMode] = useState("auto");
  const [dataProvider, setDataProvider] = useState("auto");
  const [historyScopeSelection, setHistoryScopeSelection] = useState(defaultHistoryScopeSelection);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [jobProgress, setJobProgress] = useState<AnalysisJobProgress | null>(null);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [evidenceTab, setEvidenceTab] = useState<"findings" | "edges">("findings");
  const [openFindingGroups, setOpenFindingGroups] = useState<Record<string, boolean>>({});
  const [openEdgeGroups, setOpenEdgeGroups] = useState<Record<string, boolean>>({});
  const [isInputScrolling, setIsInputScrolling] = useState(false);
  const [isEvidenceScrolling, setIsEvidenceScrolling] = useState(false);
  const [addressImportSummary, setAddressImportSummary] = useState<AddressImportSummary | null>(null);
  const [mobilePanel, setMobilePanel] = useState<WorkbenchMobilePanel>("input");
  const [showEvidenceHint, setShowEvidenceHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputScrollTimerRef = useRef<number | null>(null);
  const evidenceScrollTimerRef = useRef<number | null>(null);
  const restoredJobIdRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const evmAggregateChains = useMemo(() => getEvmAggregateChains(), []);
  const evmAggregateChainIdList = useMemo(
    () => evmAggregateChains.map((chain) => chain.chainId),
    [evmAggregateChains],
  );
  const dataModeOptions = useMemo(
    () =>
      [
        { value: "auto", label: "Auto", description: t("analysis.mode.auto.description") },
        { value: "fixture", label: "Fixture", description: t("analysis.mode.fixture.description") },
        { value: "live", label: "Live", description: t("analysis.mode.live.description") },
      ] satisfies Array<{ value: DataModeOptionValue; label: string; description: string }>,
    [t],
  );
  const dataProviderOptions = useMemo(
    () =>
      [
        { value: "auto", label: "Auto", description: t("analysis.provider.auto.description") },
        { value: "nodereal", label: "NodeReal", description: t("analysis.provider.nodereal.description") },
        { value: "etherscan", label: "Etherscan", description: t("analysis.provider.etherscan.description") },
        { value: "solscan", label: "Solscan", description: t("analysis.provider.solscan.description") },
      ] satisfies Array<{ value: DataProviderOptionValue; label: string; description: string }>,
    [t],
  );
  const historyScopeOptions = useMemo(
    () =>
      historyScopeOptionDefinitions.map((option) => ({
        key: option.value === "full" ? "full" : `window:${option.historyDays}`,
        value: option.value,
        historyDays: option.historyDays,
        label: t(option.labelKey),
        description: t(option.descriptionKey),
        helpAria: t(option.helpAriaKey),
      })),
    [t],
  );
  const selectedHistoryScope = useMemo(
    () => historyScopeOptions.find((option) => option.key === historyScopeSelection) ?? historyScopeOptions[2],
    [historyScopeSelection, historyScopeOptions],
  );
  const parsedHistoryScope = useMemo(
    () => parseHistoryScopeSelection(historyScopeSelection),
    [historyScopeSelection],
  );
  const effectiveChainIds = useMemo(
    () =>
      chainId === String(evmAggregateChainId)
        ? evmAggregateChains.map((chain) => chain.chainId)
        : [Number(chainId)],
    [chainId, evmAggregateChains],
  );
  const parsedAddresses = useMemo(() => parseAddressImport(addresses).addresses, [addresses]);
  const addressCount = parsedAddresses.length;
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
  const chainSelectOptions = useMemo(
    () => [
      { value: String(evmAggregateChainId), label: "EVM ALL" },
      ...supportedChains.map((chain) => ({
        value: String(chain.chainId),
        label: `${chain.shortName} · ${chain.name}`,
      })),
    ],
    [supportedChains],
  );

  function applyChainSelection(nextChainId: string) {
    setChainId(nextChainId);
    const chain = supportedChains.find((item) => String(item.chainId) === nextChainId);
    if (nextChainId === String(evmAggregateChainId)) {
      if (dataProvider === "solscan") {
        setDataProvider("auto");
      }
      return;
    }
    if (chain?.ecosystem === "solana") {
      setDataProvider("solscan");
    } else if (dataProvider === "solscan") {
      setDataProvider("auto");
    }
  }
  const submitScopeSummary = useMemo(
    () => t("analysis.address.scope", { scope: inputScopeLabel, count: addressCount }),
    [addressCount, inputScopeLabel, t],
  );
  const submitStatusHint = isRunning
    ? t("analysis.submit.running")
    : t("analysis.submit.ready");
  const modeDescription = useMemo(() => {
    if (dataMode === "live") {
      return liveConfigured
        ? t("analysis.mode.liveReady")
        : t("analysis.mode.liveMissing");
    }

    if (dataMode === "fixture") {
      return t("analysis.mode.fixture");
    }

    return liveConfigured
      ? t("analysis.mode.autoLive")
      : t("analysis.mode.autoFixture");
  }, [dataMode, liveConfigured, t]);

  useEffect(() => {
    const replayJobId = searchParams.get("job");
    const freshStart = searchParams.get("fresh") === "1";

    if (freshStart) {
      forgetActiveAnalysisJob(readActiveAnalysisJobId());
      clearWorkbenchJobUrl();
      restoredJobIdRef.current = null;
      setError(null);
      return;
    }

    const activeJobId = replayJobId ?? readActiveAnalysisJobId();

    if (!activeJobId || restoredJobIdRef.current === activeJobId) {
      return;
    }

    restoredJobIdRef.current = activeJobId;
    void loadAnalysisJob(activeJobId, Boolean(replayJobId));
  }, [searchParams]);

  useEffect(() => {
    const resumeVisibleWorkbench = () => {
      if (searchParams.get("fresh") === "1" || isRunning) {
        return;
      }

      const replayJobId = searchParams.get("job");
      const activeJobId = replayJobId ?? readActiveAnalysisJobId();

      if (!activeJobId || result || restoredJobIdRef.current === activeJobId) {
        return;
      }

      restoredJobIdRef.current = activeJobId;
      void loadAnalysisJob(activeJobId, Boolean(replayJobId));
    };

    const handlePageShow = () => {
      resumeVisibleWorkbench();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resumeVisibleWorkbench();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [searchParams, result, isRunning]);

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

    const graphView = result.graphView ?? result.graph;

    return {
      wallets: result.meta.graphWalletCount,
      contracts: result.meta.graphContractCount,
      edges: graphView.totalEdges,
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
      current.summary = describeFindingGroup(t, finding.title, current.findings.length);
      groups.set(finding.title, current);
    }

    return Array.from(groups.values()).sort((left, right) => right.findings.length - left.findings.length);
  }, [result, locale, t]);

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

  function applyWorkbenchInputFromResult(analysisResult: AnalysisResponse) {
    const restored = deriveWorkbenchInputFromResult(analysisResult, evmAggregateChainIdList);
    setAddresses(restored.addresses);
    setChainId(restored.chainId);
    setDataMode(restored.dataMode);
    setDataProvider(restored.dataProvider);
    setHistoryScopeSelection(
      resolveHistoryScopeSelection(
        restored.historyScope === "full" ? "full" : "window",
        restored.historyDays,
      ),
    );
    setAddressImportSummary(null);
  }

  async function loadAnalysisJob(jobId: string, explicitReplay = false) {
    setError(null);

    try {
      const maxAttempts = explicitReplay ? 1 : activeAnalysisJobRestoreAttempts;
      let response: Response | null = null;
      let body: AnalysisJobPollResponse | { error?: string } | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        response = await fetch(`/api/analyze/jobs/${jobId}`);
        body = await readJsonResponse<AnalysisJobPollResponse | { error?: string }>(response);

        if (response.status !== 404 || attempt === maxAttempts) {
          break;
        }

        await sleep(activeAnalysisJobRestoreDelayMs);
      }

      if (!response || !body) {
        throw new Error(t("analysis.error.loadSaved"));
      }

      if (!response.ok) {
        if (response.status === 404) {
          forgetActiveAnalysisJob(jobId);
          restoredJobIdRef.current = null;

          if (!explicitReplay) {
            return;
          }
        }

        throw new Error("error" in body && body.error ? body.error : t("analysis.error.loadSaved"));
      }

      const poll = body as AnalysisJobPollResponse;
      setJobProgress(poll.progress);
      setAnalysisStartedAt(resolveAnalysisStartedAt(poll, analysisStartedAt));

      if (poll.status === "completed" && poll.result) {
        rememberActiveAnalysisJob(jobId);
        saveSessionHistoryJob(jobId, poll.result, {
          createdAt: poll.createdAt,
          startedAt: poll.startedAt,
        });
        applyWorkbenchInputFromResult(poll.result);
        setResult(poll.result);
        setMobilePanel("graph");
        setIsRunning(false);
        setJobProgress(null);
        return;
      }

      if (poll.status === "failed") {
        forgetActiveAnalysisJob(jobId);
        throw new Error(poll.error ?? t("analysis.error.generic"));
      }

      const controller = new AbortController();
      setIsRunning(true);
      setMobilePanel("graph");
      setShowEvidenceHint(false);
      setAnalysisStartedAt(Date.now());
      setResult(null);
      setEvidenceTab("findings");
      const analysisResult = await pollAnalyzeJob(jobId, controller.signal);
      rememberActiveAnalysisJob(jobId);
      applyWorkbenchInputFromResult(analysisResult);
      setResult(analysisResult);
      if (shouldShowEvidenceHint(jobId)) {
        setShowEvidenceHint(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("analysis.error.loadSaved"));
    } finally {
      setIsRunning(false);
      setJobProgress(null);
      setAnalysisStartedAt(null);
    }
  }

  async function pollAnalyzeJob(jobId: string, signal: AbortSignal): Promise<AnalysisResponse> {
    while (!signal.aborted) {
      const response = await fetch(`/api/analyze/jobs/${jobId}`, { signal });
      const body = await readJsonResponse<AnalysisJobPollResponse | { error?: string }>(response);

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : t("analysis.error.poll"));
      }

      const poll = body as AnalysisJobPollResponse;
      setJobProgress(poll.progress);
      setAnalysisStartedAt(resolveAnalysisStartedAt(poll, analysisStartedAt));

      if (poll.status === "completed" && poll.result) {
        saveSessionHistoryJob(jobId, poll.result, {
          createdAt: poll.createdAt,
          startedAt: poll.startedAt,
        });
        return poll.result;
      }

      if (poll.status === "failed") {
        throw new Error(poll.error ?? t("analysis.error.generic"));
      }

      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }

    throw new Error(t("analysis.error.cancelled"));
  }

  async function runAnalysis() {
    setIsRunning(true);
    setAnalysisStartedAt(Date.now());
    setJobProgress(null);
    setError(null);
    setResult(null);
    setEvidenceTab("findings");
    setOpenFindingGroups({});
    setOpenEdgeGroups({});
    setMobilePanel("graph");
    setShowEvidenceHint(false);

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
          historyScope: parsedHistoryScope.historyScope,
          ...(parsedHistoryScope.historyDays ? { historyDays: parsedHistoryScope.historyDays } : {}),
        }),
        signal: controller.signal,
      });
      const body = await readJsonResponse<AnalysisJobStartResponse | { error?: string }>(response);

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : t("analysis.error.generic"));
      }

      if (!("jobId" in body) || !body.jobId) {
        throw new Error(t("analysis.error.noJob"));
      }

      jobId = body.jobId;
      restoredJobIdRef.current = body.jobId;
      rememberActiveAnalysisJob(body.jobId);

      const analysisResult = await pollAnalyzeJob(body.jobId, controller.signal);
      setResult(analysisResult);
      if (shouldShowEvidenceHint(body.jobId)) {
        setShowEvidenceHint(true);
      }
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") {
        return;
      }

      forgetActiveAnalysisJob(jobId);
      setError(caught instanceof Error ? caught.message : t("analysis.error.generic"));
    } finally {
      setIsRunning(false);
      setJobProgress(null);
      setAnalysisStartedAt(null);
    }
  }

  async function importAddressFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const text = await file.text();
    const summary = parseAddressImport(text);

    setAddressImportSummary(summary);

    if (summary.addresses.length > 0) {
      setAddresses(summary.addresses.join("\n"));
    }
  }

  async function downloadReport() {
    if (!result) {
      return;
    }

    await downloadAnalysisReport(result, "pdf");
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

  function dismissEvidenceHint() {
    const activeJobId = readActiveAnalysisJobId();
    if (activeJobId) {
      rememberDismissedEvidenceHint(activeJobId);
    }
    setShowEvidenceHint(false);
  }

  return (
    <>
      <section
        className={`workbench workbenchMobilePanel-${mobilePanel}`}
        aria-label="Wallet Map workbench"
      >
      <WorkbenchMobileTabs
        activePanel={mobilePanel}
        onChange={setMobilePanel}
        findingsCount={result?.findings.length ?? 0}
        showEvidenceHint={showEvidenceHint && mobilePanel !== "evidence"}
        onDismissEvidenceHint={dismissEvidenceHint}
      />
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
          <div className="inputPanelHero">
            <div className="inputPanelHeroCopy">
              <span className="panelEyebrow">{t("analysis.input.eyebrow")}</span>
              <h2>{t("analysis.input.title")}</h2>
              <p className="inputPanelSubtitle">
                {t("analysis.address.scope", { scope: inputScopeLabel, count: addressCount })}
              </p>
            </div>
          </div>

          <section className="addressInputCard" aria-labelledby="addresses-label">
            <div className="addressInputCardHeader">
              <div className="addressInputCardTitle">
                <label id="addresses-label" htmlFor="addresses">
                  {t("analysis.address.label")}
                </label>
                <span className="addressCountBadge">{addressCount}</span>
              </div>
              <div className="addressInputCardActions">
                <button
                  type="button"
                  className="ghostButton"
                  disabled={isRunning}
                  onClick={() => {
                    setAddresses(defaultAddresses);
                    setAddressImportSummary(null);
                  }}
                >
                  <ClipboardList size={14} strokeWidth={2.1} />
                  {t("analysis.address.sample")}
                </button>
                <button
                  type="button"
                  className="ghostButton"
                  disabled={isRunning}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} strokeWidth={2.1} />
                  {t("analysis.address.import")}
                </button>
              </div>
            </div>
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
            <AddressInputComposer
              id="addresses"
              addresses={addresses}
              disabled={isRunning}
              onChange={setAddresses}
              onImportSummaryClear={() => setAddressImportSummary(null)}
            />
            <p className="addressInputHint">{t("analysis.address.hint")}</p>
            {addressImportSummary ? (
              <div className="addressImportSummary" role="status">
                <strong>
                  {t("analysis.import.valid", { count: addressImportSummary.validCount })}
                  {addressImportSummary.duplicateCount > 0
                    ? ` · ${t("analysis.import.duplicates", { count: addressImportSummary.duplicateCount })}`
                    : ""}
                </strong>
                {addressImportSummary.invalidRows.length > 0 ? (
                  <span>
                    {t("analysis.import.invalidPrefix", { count: addressImportSummary.invalidRows.length })}
                    {" "}
                    {addressImportSummary.invalidRows
                      .slice(0, 3)
                      .map((item) => t("analysis.import.invalidRow", { row: item.row }))
                      .join("、")}
                    {addressImportSummary.invalidRows.length > 3 ? "…" : ""}
                  </span>
                ) : (
                  <span>{t("analysis.import.noInvalid")}</span>
                )}
              </div>
            ) : null}
          </section>

          <div className="inputStatusStack">
            <div className="dataReadinessTip" title={modeDescription} aria-live="polite">
              <Database size={14} strokeWidth={2.1} aria-hidden="true" />
              <span>{liveConfigured ? t("analysis.status.liveReady") : t("analysis.status.fixtureDefault")}</span>
            </div>
            {anonymousAnalysisQuota ? (
              <div className="stateBanner stateBannerCompact stateBannerInfo" aria-live="polite">
                <strong>{t("analysis.quota.title")}</strong>
                <span>
                  {t("analysis.quota.body", {
                    remaining: anonymousAnalysisQuota.remaining,
                    limit: anonymousAnalysisQuota.limit,
                  })}
                </span>
              </div>
            ) : null}
          </div>

          <div className="inputSectionLabel">{t("analysis.config.title")}</div>
          <div className="controlStack">
            <div className="controlGroup controlCard">
              <div className="controlLabelRow">
                <span>
                  <Layers3 size={15} strokeWidth={2.2} />
                  {t("analysis.config.chain")}
                </span>
                <small>{selectedChain?.explorerName ?? "Explorer"}</small>
              </div>
              <div className="segmentedControl segmentedControlChains desktopOnly" role="radiogroup" aria-label={t("analysis.config.chain.aria")}>
                <button
                  type="button"
                  className={`segmentedButton ${chainId === String(evmAggregateChainId) ? "segmentedButtonActive" : ""}`}
                  disabled={isRunning}
                  onClick={() => applyChainSelection(String(evmAggregateChainId))}
                  role="radio"
                  aria-checked={chainId === String(evmAggregateChainId)}
                  title={t("analysis.config.evmAllTitle")}
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
                    onClick={() => applyChainSelection(String(chain.chainId))}
                    role="radio"
                    aria-checked={String(chain.chainId) === chainId}
                  >
                    <small>{chain.ecosystem === "solana" ? "SVM" : "EVM"}</small>
                    <span>{chain.shortName}</span>
                  </button>
                ))}
              </div>
              <label className="mobileControlSelect mobileOnly">
                <select
                  aria-label={t("analysis.config.chain")}
                  value={chainId}
                  disabled={isRunning}
                  onChange={(event) => applyChainSelection(event.target.value)}
                >
                  {chainSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="controlGroup controlCard">
              <div className="controlLabelRow">
                <span>
                  <Globe2 size={15} strokeWidth={2.2} />
                  {t("analysis.config.provider")}
                </span>
                <small>{dataProviderOptions.find((option) => option.value === dataProvider)?.description}</small>
              </div>
              <div className="segmentedControl segmentedControlModes desktopOnly" role="radiogroup" aria-label={t("analysis.config.provider.aria")}>
                {dataProviderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmentedButton ${dataProvider === option.value ? "segmentedButtonActive" : ""}`}
                    disabled={isRunning}
                    onClick={() => setDataProvider(option.value)}
                    role="radio"
                    aria-checked={dataProvider === option.value}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
              <label className="mobileControlSelect mobileOnly">
                <select
                  aria-label={t("analysis.config.provider")}
                  value={dataProvider}
                  disabled={isRunning}
                  onChange={(event) => setDataProvider(event.target.value as DataProviderOptionValue)}
                >
                  {dataProviderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="controlGroup controlCard">
              <div className="controlLabelRow">
                <span>
                  <Database size={15} strokeWidth={2.2} />
                  {t("analysis.config.dataSource")}
                </span>
                <small>{dataMode === "live" ? t("analysis.data.live") : dataMode === "fixture" ? t("analysis.data.fixture") : t("analysis.data.auto")}</small>
              </div>
              <div className="segmentedControl segmentedControlModes desktopOnly" role="radiogroup" aria-label={t("analysis.config.dataSource.aria")}>
                {dataModeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmentedButton ${dataMode === option.value ? "segmentedButtonActive" : ""}`}
                    disabled={isRunning}
                    onClick={() => setDataMode(option.value)}
                    role="radio"
                    aria-checked={dataMode === option.value}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
              <label className="mobileControlSelect mobileOnly">
                <select
                  aria-label={t("analysis.config.dataSource")}
                  value={dataMode}
                  disabled={isRunning}
                  onChange={(event) => setDataMode(event.target.value as DataModeOptionValue)}
                >
                  {dataModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="controlGroup controlCard">
              <div className="controlLabelRow">
                <span className="controlLabelHeading">
                  <Layers3 size={15} strokeWidth={2.2} />
                  {t("analysis.config.history")}
                  <FindingHelpTip
                    description={selectedHistoryScope?.description ?? ""}
                    label={selectedHistoryScope?.helpAria ?? t("analysis.history.helpAria")}
                  />
                </span>
              </div>
              <div className="segmentedControl segmentedControlHistory desktopOnly" role="radiogroup" aria-label={t("analysis.config.history.aria")}>
                {historyScopeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`segmentedButton ${historyScopeSelection === option.key ? "segmentedButtonActive" : ""}`}
                    disabled={isRunning}
                    onClick={() => setHistoryScopeSelection(option.key)}
                    role="radio"
                    aria-checked={historyScopeSelection === option.key}
                    title={option.description}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <small className="historyScopeHint desktopOnly">{selectedHistoryScope?.description}</small>
              <label className="mobileControlSelect mobileOnly">
                <select
                  aria-label={t("analysis.config.history")}
                  value={historyScopeSelection}
                  disabled={isRunning}
                  onChange={(event) => setHistoryScopeSelection(event.target.value)}
                >
                  {historyScopeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </form>

        <section className="resultPanel summaryPanel">
          <div className="resultHeader">
            <div>
              <span className="panelEyebrow">{t("analysis.summary.eyebrow")}</span>
              <h2>{t("analysis.summary.title")}</h2>
              <p>
                {result
                  ? result.sourceLabel ??
                    `${result.meta.chainName} · ${
                      result.meta.resolvedMode === "live" ? "Live" : "Fixture"
                    }`
                  : t("analysis.summary.waiting")}
              </p>
            </div>
            {result ? (
              <div className="resultHeaderActions">
                <button
                  type="button"
                  className="secondaryButton reportButtonInline"
                  onClick={() => void downloadReport()}
                >
                  <FileText size={15} strokeWidth={2.1} />
                  PDF
                </button>
                <span className="statusPill statusSuccess">{t("analysis.summary.status.complete")}</span>
              </div>
            ) : null}
            {isRunning ? <span className="statusPill statusRunning">{t("analysis.summary.status.running")}</span> : null}
          </div>
          {isRunning ? (
            <div className="emptyStateBlock emptyStateRunning">
              <strong>{t("analysis.summary.runningTitle")}</strong>
              <p>{t("analysis.summary.runningBody")}</p>
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
              <ExposureScoreDimensions
                dimensions={result.score.dimensions}
                topSignals={result.score.topSignals}
              />
              {result.meta.fallbackReason ? (
                <div className="stateBanner stateBannerInfo">
                  <strong>{t("analysis.summary.fixtureFallback")}</strong>
                  <span>{result.meta.fallbackReason}</span>
                </div>
              ) : null}
              {result.meta.warnings?.length ? (
                <div className="stateBanner stateBannerWarning">
                  <strong>{t("analysis.summary.skippedChains")}</strong>
                  <span>{formatSkippedChainSummary(t, result.meta.warnings)}</span>
                  <details className="warningDetails">
                    <summary>{t("analysis.summary.details")}</summary>
                    <ul>
                      {formatSkippedChainDetails(t, result.meta.warnings).map((warning) => (
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
                        {formatVerdictLabel(t, result.summary.verdict)}
                      </span>
                      <span className="verdictSubtle">
                        {t("analysis.summary.walletPairHits", { count: result.summary.pairInsights.length })}
                      </span>
                    </div>
                  </div>
                  <div className="pairInsightList">
                    {result.summary.pairInsights.slice(0, 3).map((pair) => (
                      <PairInsightCard key={pair.id} pair={pair} t={t} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="emptyStateBlock emptyStatePositive">
                  <strong>{t("analysis.summary.noSignalsTitle")}</strong>
                  <p>{t("analysis.summary.noSignalsBody")}</p>
                </div>
              )}
              <div className="metricGrid">
                <div>
                  <span><WalletCards size={14} strokeWidth={2.1} /> {t("analysis.metrics.watched")}</span>
                  <strong>{result.meta.watchedAddressCount}</strong>
                </div>
                <div>
                  <span><Database size={14} strokeWidth={2.1} /> {t("analysis.metrics.events")}</span>
                  <strong>{result.meta.eventCount}</strong>
                </div>
                <div>
                  <span>{t("analysis.metrics.contracts")}</span>
                  <strong>{graphSummary.contracts}</strong>
                </div>
                <div>
                  <span>{t("analysis.metrics.edges")}</span>
                  <strong>{graphSummary.edges}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="emptyStateBlock">
              <strong>{t("analysis.summary.emptyTitle")}</strong>
              <p>{t("analysis.summary.emptyBody")}</p>
            </div>
          )}
        </section>
        </div>

        <div className="analysisSubmitDock" aria-live="polite">
          {error ? (
            <div className="stateBanner stateBannerError analysisSubmitError" role="alert">
              <strong>{t("analysis.error.title")}</strong>
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
              {isRunning ? t("analysis.submit.runningButton") : t("analysis.submit.button")}
            </button>
          </div>
        </div>
      </aside>

      <section className="workbenchColumn workbenchGraph">
        <header className="workbenchColumnHeader">
          <div>
            <h2>{t("analysis.graph.title")}</h2>
            <p>
              {result
                ? `${result.meta.graphWalletCount} wallets · ${result.meta.graphContractCount} contracts · ${t("analysis.graph.edgeCount", { count: (result.graphView ?? result.graph).totalEdges })}`
                : t("analysis.graph.placeholderMeta")}
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
                startedAt={analysisStartedAt}
                variant="hero"
              />
            </div>
          ) : result && (result.graphView ?? result.graph).totalEdges > 0 ? (
            <GraphExplorer
              chainId={result.graphView?.defaultChainId ?? result.meta.chainId}
              nodes={(result.graphView ?? result.graph).nodes}
              edges={(result.graphView ?? result.graph).edges}
              totalNodes={(result.graphView ?? result.graph).totalNodes}
              totalEdges={(result.graphView ?? result.graph).totalEdges}
              truncated={(result.graphView ?? result.graph).nodesTruncated || (result.graphView ?? result.graph).edgesTruncated}
              isPanelActive={mobilePanel === "graph"}
            />
          ) : (
            <div className="graphPlaceholder">
              <div className="graphPlaceholderIcon" aria-hidden="true">
                <Activity size={26} strokeWidth={2.1} />
              </div>
              <strong>{result ? t("analysis.graph.emptyWithResult") : t("analysis.graph.emptyBeforeRun")}</strong>
              <p>
                {result
                  ? t("analysis.graph.emptyWithResultBody")
                  : t("analysis.graph.emptyBeforeRunBody")}
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="workbenchColumn workbenchFindings">
        <header className="workbenchColumnHeader workbenchFindingsHeader">
          <div className="workbenchFindingsTitle">
            <div className="panelTabs" role="tablist" aria-label={t("analysis.evidence.tabs")}>
              <button
                type="button"
                role="tab"
                aria-selected={evidenceTab === "findings"}
                className={`panelTab ${evidenceTab === "findings" ? "panelTabActive" : ""}`}
                onClick={() => setEvidenceTab("findings")}
              >
                {t("analysis.evidence.findings")}
                {result ? <span className="panelTabCount">{result.findings.length}</span> : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={evidenceTab === "edges"}
                className={`panelTab ${evidenceTab === "edges" ? "panelTabActive" : ""}`}
                onClick={() => setEvidenceTab("edges")}
              >
                {t("analysis.evidence.edges")}
                {result ? <span className="panelTabCount">{result.graph.totalEdges}</span> : null}
              </button>
            </div>
            <p>
              {result
                ? evidenceTab === "findings"
                  ? `${result.meta.chainName} · ${t("analysis.evidence.signalMeta")}`
                  : t("analysis.evidence.edgeMeta", { count: result.graph.totalEdges })
                : t("analysis.evidence.stream")}
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
    </>
  );
}

function resolveAnalysisStartedAt(
  poll: Pick<AnalysisJobPollResponse, "startedAt" | "createdAt">,
  fallback: number | null,
): number | null {
  const timestamp = poll.startedAt ?? poll.createdAt;

  if (!timestamp) {
    return fallback;
  }

  const parsed = Date.parse(timestamp);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
