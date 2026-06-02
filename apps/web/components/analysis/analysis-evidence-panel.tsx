import { ChevronDown } from "lucide-react";
import { formatEdgeKindLabel } from "../../app/format";
import { EdgeRow, EvidenceItemView, FindingChainBadges } from "./analysis-evidence";
import {
  describeEdgeGroup,
  formatFindingConfidenceText,
  formatFindingRiskLabel,
} from "./analysis-formatters";
import { LoadingList } from "./analysis-progress";
import type { AnalysisResponse, GraphEdge, GraphNode } from "./analysis-types";

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
  if (isRunning) {
    return <LoadingList />;
  }

  if (!result) {
    return (
      <div className="emptyStateBlock">
        <strong>暂无证据</strong>
        <p>分析完成后这里会列出 findings 和 graph edges，各自独立滚动，不会挤占图谱区域。</p>
      </div>
    );
  }

  if (evidenceTab === "findings") {
    return result.findings.length > 0 ? (
      <FindingGroups
        groups={groupedFindings}
        result={result}
        watchedAddressSet={watchedAddressSet}
        isOpen={isFindingGroupOpen}
        onToggle={toggleFindingGroup}
      />
    ) : (
      <div className="emptyStateBlock emptyStatePositive">
        <strong>没有明显关联信号</strong>
        <p>分析器没有发现 watched 钱包之间的直接转账、共享 counterparty 或同合约交互。</p>
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
      <strong>暂无关联边</strong>
      <p>当前分析没有产出命中分析器规则的关系边。</p>
    </div>
  );
}

function FindingGroups({
  groups,
  result,
  watchedAddressSet,
  isOpen,
  onToggle,
}: {
  groups: FindingGroup[];
  result: AnalysisResponse;
  watchedAddressSet: Set<string>;
  isOpen: (title: string, index: number) => boolean;
  onToggle: (title: string, index: number) => void;
}) {
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
                <span className="groupedPanelTitle">{group.title}</span>
                <span className="groupedPanelHint">{group.summary}</span>
              </span>
              <span className="groupedPanelMeta">
                <span className="groupedPanelCount">{group.findings.length}</span>
                <ChevronDown size={16} strokeWidth={2.2} className="groupedPanelChevron" aria-hidden="true" />
              </span>
            </button>
            <div className="groupedPanelBody" aria-hidden={!open}>
              <div className="groupedPanelBodyInner">
                <ul className="findingList">
                  {group.findings.map((finding) => (
                    <li key={finding.id}>
                      <div className="findingHeader">
                        <strong>{finding.title}</strong>
                        <span className="findingMeta">
                          <FindingChainBadges finding={finding} fallbackChainId={result.meta.chainId} />
                          <span className={`severityPill severity-${finding.severity}`}>
                            风险 {formatFindingRiskLabel(finding.severity)}
                          </span>
                          <span className={`confidencePill confidence-${finding.confidence}`}>
                            置信 {formatFindingConfidenceText(finding.confidence)}
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
                <span className="groupedPanelTitle">{formatEdgeKindLabel(group.kind)}</span>
                <span className="groupedPanelHint">{describeEdgeGroup(group.kind, group.edges.length)}</span>
              </span>
              <span className="groupedPanelMeta">
                <span className="groupedPanelCount">{group.edges.length}</span>
                <ChevronDown size={16} strokeWidth={2.2} className="groupedPanelChevron" aria-hidden="true" />
              </span>
            </button>
            <div className="groupedPanelBody" aria-hidden={!open}>
              <div className="groupedPanelBodyInner">
                <ul className="edgeList">
                  {group.edges.map((edge) => (
                    <EdgeRow
                      key={edge.id}
                      edge={edge}
                      chainId={result.meta.chainId}
                      watchedAddressSet={watchedAddressSet}
                      nodeIndex={graphNodeIndex}
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
