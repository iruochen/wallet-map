import { ChevronDown } from "lucide-react";
import { AggregatedEdgeRow, aggregateEdgesForDisplay } from "./analysis-evidence-edge-groups";
import { EvidenceItemView, FindingChainBadges } from "./analysis-evidence";
import { isAggregatedFindingGroup, SharedFindingRow } from "./analysis-evidence-shared";
import {
  describeEdgeGroup,
  formatEdgeKindLegendLabel,
  formatFindingConfidenceText,
  formatFindingRiskLabel,
  formatFindingTitle,
} from "./analysis-formatters";
import { LoadingList } from "./analysis-progress";
import type { AnalysisResponse, GraphEdge, GraphNode } from "./analysis-types";
import { useI18n } from "../i18n/i18n-provider";

interface FindingGroup {
  title: string;
  summary: string;
  findings: AnalysisResponse["findings"];
}

interface EdgeGroup {
  kind: GraphEdge["kind"];
  edges: GraphEdge[];
}

interface AnalysisEvidencePanelProps {
  result: AnalysisResponse | null;
  isRunning: boolean;
  evidenceTab: "findings" | "edges";
  groupedFindings: FindingGroup[];
  groupedEdges: EdgeGroup[];
  watchedAddressSet: Set<string>;
  graphNodeIndex: Map<string, GraphNode>;
  isFindingGroupOpen: (title: string, index: number) => boolean;
  toggleFindingGroup: (title: string, index: number) => void;
  isEdgeGroupOpen: (kind: GraphEdge["kind"], index: number) => boolean;
  toggleEdgeGroup: (kind: GraphEdge["kind"], index: number) => void;
}

export function AnalysisEvidencePanel({
  result,
  isRunning,
  evidenceTab,
  groupedFindings,
  groupedEdges,
  watchedAddressSet,
  graphNodeIndex,
  isFindingGroupOpen,
  toggleFindingGroup,
  isEdgeGroupOpen,
  toggleEdgeGroup,
}: AnalysisEvidencePanelProps) {
  const { t } = useI18n();

  if (isRunning) {
    return <LoadingList />;
  }

  if (!result) {
    return (
      <div className="emptyStateBlock">
        <strong>{t("analysis.evidence.emptyTitle")}</strong>
        <p>{t("analysis.evidence.emptyBody")}</p>
      </div>
    );
  }

  if (evidenceTab === "findings") {
    return result.findings.length > 0 ? (
      <FindingGroups
        groups={groupedFindings}
        result={result}
        watchedAddressSet={watchedAddressSet}
        graphNodeIndex={graphNodeIndex}
        isOpen={isFindingGroupOpen}
        onToggle={toggleFindingGroup}
      />
    ) : (
      <div className="emptyStateBlock emptyStatePositive">
        <strong>{t("analysis.evidence.noSignalTitle")}</strong>
        <p>{t("analysis.evidence.noSignalBody")}</p>
      </div>
    );
  }

  return result.graph.edges.length > 0 ? (
    <EdgeGroups
      groups={groupedEdges}
      result={result}
      watchedAddressSet={watchedAddressSet}
      graphNodeIndex={graphNodeIndex}
      isOpen={isEdgeGroupOpen}
      onToggle={toggleEdgeGroup}
    />
  ) : (
    <div className="emptyStateBlock">
      <strong>{t("analysis.evidence.noEdgesTitle")}</strong>
      <p>{t("analysis.evidence.noEdgesBody")}</p>
    </div>
  );
}

function FindingGroups({
  groups,
  result,
  watchedAddressSet,
  graphNodeIndex,
  isOpen,
  onToggle,
}: {
  groups: FindingGroup[];
  result: AnalysisResponse;
  watchedAddressSet: Set<string>;
  graphNodeIndex: Map<string, GraphNode>;
  isOpen: (title: string, index: number) => boolean;
  onToggle: (title: string, index: number) => void;
}) {
  const { t, locale } = useI18n();
  const aggregated = (title: string) => isAggregatedFindingGroup(title);

  return (
    <div className="groupedPanelList">
      {groups.map((group, index) => {
        const open = isOpen(group.title, index);

        return (
          <section key={group.title} className={`groupedPanel ${open ? "groupedPanelOpen" : ""}`}>
            <button
              type="button"
              className="groupedPanelSummary"
              aria-expanded={open}
              onClick={() => onToggle(group.title, index)}
            >
              <span className="groupedPanelSummaryText">
                <span className="groupedPanelTitle">{formatFindingTitle(t, group.title)}</span>
                <span className="groupedPanelHint">{group.summary}</span>
              </span>
              <span className="groupedPanelMeta">
                <span className="groupedPanelCount">{group.findings.length}</span>
                <ChevronDown size={16} strokeWidth={2.2} className="groupedPanelChevron" aria-hidden="true" />
              </span>
            </button>
            <div className="groupedPanelBody" aria-hidden={!open}>
              <div className="groupedPanelBodyInner">
                {aggregated(group.title) ? (
                  <ul className="sharedFindingList">
                    {group.findings.map((finding) => (
                      <SharedFindingRow
                        key={finding.id}
                        finding={finding}
                        fallbackChainId={result.meta.chainId}
                        watchedAddressSet={watchedAddressSet}
                        graphNodeIndex={graphNodeIndex}
                        locale={locale}
                        t={t}
                      />
                    ))}
                  </ul>
                ) : (
                  <ul className="findingList">
                    {group.findings.map((finding) => (
                      <li key={finding.id}>
                        <div className="findingHeader">
                          <strong className="findingTitleChip" title={finding.title}>
                            {formatFindingTitle(t, finding.title)}
                          </strong>
                          <span className="findingMeta">
                            <FindingChainBadges finding={finding} fallbackChainId={result.meta.chainId} />
                            <span className={`severityPill severity-${finding.severity}`}>
                              {t("analysis.evidence.risk")} {formatFindingRiskLabel(t, finding.severity)}
                            </span>
                            <span className={`confidencePill confidence-${finding.confidence}`}>
                              {t("analysis.evidence.confidence")} {formatFindingConfidenceText(t, finding.confidence)}
                            </span>
                          </span>
                        </div>
                        <details className="findingDetails">
                          <summary>{t("analysis.evidence.details")}</summary>
                          <p>{finding.description}</p>
                        </details>
                        {finding.evidenceTruncated ? (
                          <p className="previewHint">
                            {t("analysis.evidence.previewHint", {
                              shown: finding.evidence.length,
                              total: finding.evidenceTotal,
                            })}
                          </p>
                        ) : null}
                        <div className="evidenceList">
                          {finding.evidence.map((evidence) => (
                            <EvidenceItemView
                              key={evidence.eventId}
                              evidence={evidence}
                              chainId={result.meta.chainId}
                              watchedAddressSet={watchedAddressSet}
                              locale={locale}
                              t={t}
                            />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EdgeGroups({
  groups,
  result,
  watchedAddressSet,
  graphNodeIndex,
  isOpen,
  onToggle,
}: {
  groups: EdgeGroup[];
  result: AnalysisResponse;
  watchedAddressSet: Set<string>;
  graphNodeIndex: Map<string, GraphNode>;
  isOpen: (kind: GraphEdge["kind"], index: number) => boolean;
  onToggle: (kind: GraphEdge["kind"], index: number) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="groupedPanelList">
      {groups.map((group, index) => {
        const open = isOpen(group.kind, index);

        return (
          <section key={group.kind} className={`groupedPanel ${open ? "groupedPanelOpen" : ""}`}>
            <button
              type="button"
              className="groupedPanelSummary"
              aria-expanded={open}
              onClick={() => onToggle(group.kind, index)}
            >
              <span className="groupedPanelSummaryText">
                <span className="groupedPanelTitle">{formatEdgeKindLegendLabel(t, group.kind)}</span>
                <span className="groupedPanelHint">{describeEdgeGroup(t, group.kind, group.edges.length)}</span>
              </span>
              <span className="groupedPanelMeta">
                <span className="groupedPanelCount">{group.edges.length}</span>
                <ChevronDown size={16} strokeWidth={2.2} className="groupedPanelChevron" aria-hidden="true" />
              </span>
            </button>
            <div className="groupedPanelBody" aria-hidden={!open}>
              <div className="groupedPanelBodyInner">
                <ul className="edgeList edgeListAggregated">
                  {aggregateEdgesForDisplay(group.edges).map((aggregated) => (
                    <AggregatedEdgeRow
                      key={aggregated.key}
                      group={aggregated}
                      chainId={result.meta.chainId}
                      watchedAddressSet={watchedAddressSet}
                      nodeIndex={graphNodeIndex}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
