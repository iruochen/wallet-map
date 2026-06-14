import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { AnalysisReport, ReportFinding } from "./index";

const PAGE_PADDING = 34;

const palette = {
  ink: "#17211d",
  muted: "#66736d",
  faint: "#8d9993",
  line: "#dfe6e1",
  paper: "#fbfcfa",
  wash: "#f3f7f4",
  forest: "#14372b",
  moss: "#2b6b4c",
  green: "#1f8a55",
  amber: "#bd750f",
  blue: "#3c64c8",
  red: "#a6423b",
  cream: "#fffaf0",
};

interface SignalGroup {
  title: string;
  description: string;
  severity: ReportFinding["severity"];
  confidence: ReportFinding["confidence"];
  scoreImpact: number;
  count: number;
}

export async function renderPdfReportBlob(report: AnalysisReport): Promise<Blob> {
  return pdf(<ReportDocument report={report} />).toBlob();
}

function ReportDocument({ report }: { report: AnalysisReport }) {
  const signals = summarizeFindings(report.findings);
  const pairs = report.summary?.pairInsights ?? [];

  return (
    <Document title={formatPdfText(report.title)} author="Wallet Map">
      <Page size="A4" style={styles.page}>
        <ReportHeader report={report} />
        <VerdictBand report={report} />
        <ExecutiveBrief report={report} signals={signals} />
        <MetricStrip report={report} signalCount={signals.length} />
        <DriverPanel report={report} signals={signals} />
        <ReviewerChecklist report={report} />
        <Footer report={report} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle title="Review Packet" subtitle="Signal dimensions, graph shape, and analyzer highlights." />
        <ScoreMatrix report={report} />
        <GraphOverview report={report} />
        <SignalHighlights report={report} signals={signals} />
        <Footer report={report} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle title="Signal Summary" subtitle="Prioritized finding groups with review context and impact." />
        <SignalSummary signals={signals} />
        <Footer report={report} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle title="Wallet Pair Insights" subtitle="Pairs ranked by signal strength and supporting reasons." />
        <PairInsights pairs={pairs} />
        <Footer report={report} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PageTitle title="Evidence Appendix" subtitle="Representative transaction evidence for manual review." />
        <EvidenceAppendix findings={report.findings} />
        <Methodology />
        <Footer report={report} />
      </Page>
    </Document>
  );
}

function ReportHeader({ report }: { report: AnalysisReport }) {
  return (
    <View style={styles.hero} wrap={false}>
      <View>
        <Text style={styles.brand}>WALLET MAP</Text>
        <Text style={styles.heroTitle}>Relationship Audit</Text>
        <Text style={styles.heroTitleSmall}>Report</Text>
      </View>
      <View style={styles.heroMeta}>
        <Text style={styles.heroMetaText}>Report ID</Text>
        <Text style={styles.heroMetaStrong}>{formatPdfText(report.meta?.reportId ?? "WM-UNKNOWN")}</Text>
        <Text style={styles.heroMetaText}>{formatGeneratedAt(report.generatedAt)}</Text>
        <Text style={styles.heroMetaMuted}>{formatPdfText(report.scope ?? "Unknown scope")}</Text>
        <Text style={styles.heroMetaMuted}>{formatPdfText(report.sourceLabel ?? "Unknown source")}</Text>
      </View>
    </View>
  );
}

function VerdictBand({ report }: { report: AnalysisReport }) {
  const verdict = report.summary?.verdict ?? "none";
  return (
    <View style={styles.verdictBand} wrap={false}>
      <Text style={[styles.verdictPill, { backgroundColor: strengthColor(verdict) }]}>
        {formatStrength(verdict).toUpperCase()}
      </Text>
      <Text style={styles.verdictScore}>Score {report.score.score}/100</Text>
      <Text style={styles.verdictMeta}>
        {formatConfidence(report.score.confidence)} confidence / {report.findings.length} findings / analytical
        signal, not attribution proof
      </Text>
    </View>
  );
}

function ExecutiveBrief({ report, signals }: { report: AnalysisReport; signals: SignalGroup[] }) {
  const overview = buildExecutiveOverview(report, signals);
  const drivers = uniqueFormatted(report.score.reasons).slice(0, 3);

  return (
    <View style={styles.executiveCard} wrap={false}>
      <View style={styles.executiveRail} />
      <View style={styles.executiveBody}>
        <Text style={styles.sectionTitle}>Executive Brief</Text>
        {overview.map((line) => (
          <Text key={line} style={styles.bodyText}>
            {line}
          </Text>
        ))}
      </View>
      <View style={styles.scorePanel}>
        <Text style={styles.scorePanelLabel}>RELATIONSHIP SCORE</Text>
        <View style={styles.scorePanelRow}>
          <Text style={styles.scorePanelNumber}>{report.score.score}</Text>
          <Text style={styles.scorePanelUnit}>/100</Text>
        </View>
        <Text style={styles.scorePanelSubhead}>Primary drivers</Text>
        <Text style={styles.scorePanelDrivers}>{drivers.join(" / ") || "No leading driver"}</Text>
      </View>
    </View>
  );
}

function MetricStrip({ report, signalCount }: { report: AnalysisReport; signalCount: number }) {
  const metrics = [
    ["Watched wallets", report.metrics?.watchedAddressCount ?? "—"],
    ["Events reviewed", report.metrics?.eventCount ?? "—"],
    ["Graph edges", report.metrics?.edgeCount ?? report.graph.edges.length],
    ["Signal groups", signalCount],
  ];

  return (
    <View style={styles.metricGrid} wrap={false}>
      {metrics.map(([label, value]) => (
        <View key={label} style={styles.metricCard}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricValue}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function DriverPanel({ report, signals }: { report: AnalysisReport; signals: SignalGroup[] }) {
  return (
    <View style={styles.driverRow} wrap={false}>
      <View style={styles.driverPanel}>
        <Text style={styles.darkPanelTitle}>WHAT DROVE THE RESULT</Text>
        {signals.slice(0, 3).map((signal) => {
          const width = `${Math.min(100, Math.max(14, signal.scoreImpact / 1.8))}%`;
          return (
            <View key={signal.title} style={styles.driverItem}>
              <View style={styles.driverTrack}>
                <View style={[styles.driverBar, { width }]} />
              </View>
              <View style={styles.driverTextRow}>
                <Text style={styles.driverTitle}>{formatPdfText(signal.title)}</Text>
                <Text style={styles.driverMeta}>
                  {signal.count} hits / {formatSeverity(signal.severity)} / impact {signal.scoreImpact}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.contextPanel}>
        <Text style={styles.sectionTitleSmall}>Run Context</Text>
        <Text style={styles.contextLine}>Mode: {report.meta?.resolvedMode ?? "unknown"}</Text>
        <Text style={styles.contextLine}>Provider: {formatPdfText(report.meta?.dataProvider ?? report.sourceLabel ?? "unknown")}</Text>
        <Text style={styles.contextLine}>Chain: {formatPdfText(report.meta?.chainName ?? report.scope ?? "unknown")}</Text>
        <Text style={styles.contextLine}>Fetched: {formatGeneratedAt(report.meta?.fetchedAt ?? report.generatedAt)}</Text>
      </View>
    </View>
  );
}

function ReviewerChecklist({ report }: { report: AnalysisReport }) {
  const items = [
    report.score.reasons[0]
      ? `Confirm leading driver: ${report.score.reasons[0]}`
      : "Confirm whether absence of signals matches the selected scope.",
    "Review exchange, bridge, and contract intermediaries before attribution.",
    report.score.counterEvidence[0]
      ? `Account for counter-evidence: ${report.score.counterEvidence[0]}`
      : "Check for public infrastructure that may lower review priority.",
  ];

  return (
    <View style={styles.checklist} wrap={false}>
      <Text style={styles.sectionTitleSmall}>Reviewer Checklist</Text>
      {items.map((item) => (
        <View key={item} style={styles.checkItem}>
          <Text style={styles.checkDot}>○</Text>
          <Text style={styles.checkText}>{formatPdfText(item)}</Text>
        </View>
      ))}
    </View>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.pageTitle} wrap={false}>
      <Text style={styles.pageTitleText}>{title}</Text>
      <Text style={styles.pageSubtitle}>{subtitle}</Text>
    </View>
  );
}

function ScoreMatrix({ report }: { report: AnalysisReport }) {
  const dimensions = [
    ["Funding", report.score.dimensions.funding, palette.green],
    ["Destination", report.score.dimensions.destination, palette.blue],
    ["Contract", report.score.dimensions.contract, palette.amber],
    ["Temporal", report.score.dimensions.temporal, "#7b61b1"],
    ["Asset", report.score.dimensions.asset, "#4f93a1"],
  ] as const;

  return (
    <View style={styles.block} wrap={false}>
      <Text style={styles.sectionTitle}>Score Dimension Matrix</Text>
      {dimensions.map(([label, value, color]) => (
        <View key={label} style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>{label}</Text>
          <View style={styles.scoreTrack}>
            <View style={[styles.scoreBar, { width: `${Math.max(3, value)}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.scoreValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function GraphOverview({ report }: { report: AnalysisReport }) {
  const values = [
    ["Watched", report.metrics?.watchedAddressCount ?? 0],
    ["Events", report.metrics?.eventCount ?? 0],
    ["Wallet nodes", report.metrics?.walletCount ?? countNodesByKind(report, "wallet")],
    ["Contract nodes", report.metrics?.contractCount ?? countNodesByKind(report, "contract")],
    ["Edges", report.metrics?.edgeCount ?? report.graph.edges.length],
  ] as const;
  const max = Math.max(...values.map(([, value]) => Number(value)), 1);

  return (
    <View style={styles.block} wrap={false}>
      <Text style={styles.sectionTitle}>Graph Overview</Text>
      {values.map(([label, value], index) => (
        <View key={label} style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>{label}</Text>
          <View style={styles.scoreTrack}>
            <View
              style={[
                styles.scoreBar,
                {
                  width: `${Math.max(3, (Number(value) / max) * 100)}%`,
                  backgroundColor: index === 1 ? palette.blue : palette.green,
                },
              ]}
            />
          </View>
          <Text style={styles.scoreValue}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function SignalHighlights({ report, signals }: { report: AnalysisReport; signals: SignalGroup[] }) {
  const rows =
    report.summary?.signalHighlights && report.summary.signalHighlights.length > 0
      ? report.summary.signalHighlights.map((item) => ({
          title: item.title,
          meta: `${item.analyzerId} / count ${item.count}`,
        }))
      : signals.map((signal) => ({
          title: signal.title,
          meta: `count ${signal.count} / ${formatSeverity(signal.severity)} / impact ${signal.scoreImpact}`,
        }));

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>Signal Highlights</Text>
      {rows.slice(0, 8).map((row, index) => (
        <View key={`${row.title}-${index}`} style={styles.highlightRow} wrap={false}>
          <Text style={styles.highlightIndex}>{String(index + 1).padStart(2, "0")}</Text>
          <View style={styles.highlightBody}>
            <Text style={styles.highlightTitle}>{formatPdfText(row.title)}</Text>
            <Text style={styles.highlightMeta}>{formatPdfText(row.meta)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SignalSummary({ signals }: { signals: SignalGroup[] }) {
  if (signals.length === 0) {
    return <Text style={styles.bodyText}>No findings were generated.</Text>;
  }

  return (
    <View>
      {signals.slice(0, 8).map((signal) => (
        <View key={signal.title} style={styles.signalCard} wrap={false}>
          <View style={[styles.severityPill, { backgroundColor: severityColor(signal.severity) }]}>
            <Text style={styles.severityPillText}>{formatSeverity(signal.severity).toUpperCase()}</Text>
          </View>
          <View style={styles.signalBody}>
            <Text style={styles.cardTitle}>{formatPdfText(signal.title)}</Text>
            <Text style={styles.cardMeta}>
              Count {signal.count} / Risk {formatSeverity(signal.severity)} / Confidence{" "}
              {formatConfidence(signal.confidence)}
            </Text>
            <Text style={styles.cardDescription}>{formatPdfText(signal.description)}</Text>
          </View>
          <View style={styles.impactBox}>
            <Text style={styles.impactLabel}>impact</Text>
            <Text style={styles.impactValue}>{signal.scoreImpact}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PairInsights({
  pairs,
}: {
  pairs: NonNullable<NonNullable<AnalysisReport["summary"]>["pairInsights"]>;
}) {
  if (pairs.length === 0) {
    return <Text style={styles.bodyText}>No wallet pair insight was generated.</Text>;
  }

  return (
    <View>
      {pairs.slice(0, 8).map((pair, index) => (
        <View key={`${pair.labels.join("-")}-${index}`} style={styles.pairCard} wrap={false}>
          <View style={[styles.rankBadge, { backgroundColor: strengthColor(pair.strength) }]}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <View style={styles.pairBody}>
            <Text style={styles.cardTitle}>{formatPdfText(pair.labels.join("  ->  "))}</Text>
            <Text style={styles.cardMeta}>
              Chains {formatChainShortNames(pair.chainIds)} / Strength {formatStrength(pair.strength)} / Score {pair.score} /{" "}
              {formatConfidence(pair.confidence)} confidence / {pair.signalCount} signals
            </Text>
            <View style={styles.reasonRow}>
              {pair.reasons.slice(0, 4).map((reason) => (
                <Text key={reason} style={styles.reasonPill}>
                  {formatPdfText(reason)}
                </Text>
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function EvidenceAppendix({ findings }: { findings: ReportFinding[] }) {
  const rows = findings
    .flatMap((finding) =>
      finding.evidence.slice(0, 2).map((evidence) => ({
        title: finding.title,
        evidence: evidence.summary || evidence.eventId,
        txHash: evidence.txHash ?? evidence.event?.txHash,
        blockNumber: evidence.event?.blockNumber,
        timestamp: evidence.event?.timestamp,
      })),
    )
    .slice(0, 16);

  if (rows.length === 0) {
    return <Text style={styles.bodyText}>No transaction evidence was attached.</Text>;
  }

  return (
    <View>
      {rows.map((row, index) => (
        <View key={`${row.title}-${index}`} style={styles.evidenceCard} wrap={false}>
          <View style={styles.evidenceTag}>
            <Text style={styles.evidenceTagText}>EV-{String(index + 1).padStart(2, "0")}</Text>
          </View>
          <View style={styles.evidenceBody}>
            <Text style={styles.evidenceTitle}>{formatPdfText(row.title)}</Text>
            <Text style={styles.evidenceMeta}>
              {row.txHash ? `tx ${truncateMiddle(formatPdfText(row.txHash), 26)}` : "tx unknown"}
              {row.blockNumber ? ` / block ${row.blockNumber}` : ""}
              {row.timestamp ? ` / ${formatGeneratedAt(row.timestamp)}` : ""}
            </Text>
            <Text style={styles.evidenceSummary}>{formatPdfText(row.evidence)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Methodology() {
  return (
    <View style={styles.methodology} wrap={false}>
      <Text style={styles.sectionTitleSmall}>Methodology & Limitations</Text>
      <Text style={styles.bodyText}>
        Methodology: Wallet Map builds a relationship graph from watched wallet events and runs analyzers for direct
        transfers, shared counterparties, shared funding, multi-hop paths, temporal overlap, and shared destination
        signals. Limitations: outputs are analytical signals, not attribution proof. Review exchange, bridge, and
        contract-mediated flows before making decisions.
      </Text>
    </View>
  );
}

function Footer({ report }: { report: AnalysisReport }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Wallet Map / {formatPdfText(report.meta?.reportId ?? "WM-UNKNOWN")} / Analytical signals only.
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING,
    paddingRight: PAGE_PADDING,
    paddingBottom: 52,
    paddingLeft: PAGE_PADDING,
    fontFamily: "Helvetica",
    color: palette.ink,
    backgroundColor: "#ffffff",
    fontSize: 9,
  },
  hero: {
    minHeight: 118,
    borderRadius: 12,
    backgroundColor: palette.forest,
    color: "#ffffff",
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: { fontSize: 8, fontWeight: 700, letterSpacing: 1.3, marginBottom: 14 },
  heroTitle: { fontFamily: "Times-Bold", fontSize: 29, lineHeight: 1.05 },
  heroTitleSmall: { fontFamily: "Times-Bold", fontSize: 23, lineHeight: 1.08 },
  heroMeta: {
    width: 150,
    padding: 12,
    borderRadius: 9,
    backgroundColor: "#24563f",
  },
  heroMetaText: { fontSize: 7.5, color: "#dcebe1", marginBottom: 3 },
  heroMetaStrong: { fontSize: 9, color: "#ffffff", fontWeight: 700, marginBottom: 8 },
  heroMetaMuted: { fontSize: 7.5, color: "#dcebe1", marginTop: 6 },
  verdictBand: {
    marginTop: 12,
    minHeight: 42,
    border: `1 solid ${palette.line}`,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  verdictPill: {
    minWidth: 78,
    borderRadius: 6,
    color: "#ffffff",
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 12,
    fontSize: 8,
    fontWeight: 700,
    textAlign: "center",
  },
  verdictScore: { fontFamily: "Times-Bold", fontSize: 13 },
  verdictMeta: { color: palette.muted, fontSize: 8.5, flex: 1 },
  executiveCard: {
    marginTop: 18,
    border: `1 solid ${palette.line}`,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    minHeight: 150,
  },
  executiveRail: { width: 26, borderRadius: 7, backgroundColor: "#edf5ef" },
  executiveBody: { flex: 1 },
  sectionTitle: { fontFamily: "Times-Bold", fontSize: 15, marginBottom: 8, color: palette.ink },
  sectionTitleSmall: { fontFamily: "Times-Bold", fontSize: 12.5, marginBottom: 8, color: palette.ink },
  bodyText: { fontSize: 9, color: palette.muted, lineHeight: 1.45, marginBottom: 4 },
  scorePanel: { width: 132 },
  scorePanelLabel: {
    backgroundColor: palette.forest,
    color: "#ffffff",
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    paddingTop: 12,
    paddingHorizontal: 14,
    fontSize: 7.2,
    fontWeight: 700,
  },
  scorePanelRow: {
    backgroundColor: palette.forest,
    color: "#ffffff",
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    paddingBottom: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
  },
  scorePanelNumber: { fontFamily: "Times-Bold", fontSize: 28 },
  scorePanelUnit: { fontSize: 8, fontWeight: 700, paddingBottom: 5 },
  scorePanelSubhead: { marginTop: 13, fontSize: 8, fontWeight: 700, color: palette.ink },
  scorePanelDrivers: { marginTop: 5, fontSize: 7.6, lineHeight: 1.35, color: palette.muted },
  metricGrid: { marginTop: 18, flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    border: `1 solid ${palette.line}`,
    borderRadius: 8,
    padding: 12,
    minHeight: 58,
  },
  metricLabel: { fontSize: 7.4, color: palette.muted, fontWeight: 700, textTransform: "uppercase" },
  metricValue: { marginTop: 9, fontFamily: "Times-Bold", fontSize: 22, color: palette.ink },
  driverRow: { marginTop: 18, flexDirection: "row", gap: 14 },
  driverPanel: { flex: 1.35, borderRadius: 10, backgroundColor: palette.forest, padding: 16 },
  darkPanelTitle: { color: "#ffffff", fontSize: 8, fontWeight: 700, marginBottom: 10 },
  driverItem: { marginBottom: 10 },
  driverTrack: { height: 14, borderRadius: 5, backgroundColor: "#315b49", overflow: "hidden" },
  driverBar: { height: 14, borderRadius: 5, backgroundColor: "#dcefe0" },
  driverTextRow: { marginTop: -13, paddingHorizontal: 8 },
  driverTitle: { color: palette.forest, fontSize: 7.3, fontWeight: 700 },
  driverMeta: { marginTop: 5, color: "#ffffff", fontSize: 7.3, fontWeight: 700 },
  contextPanel: { flex: 0.9, border: `1 solid ${palette.line}`, borderRadius: 10, padding: 16 },
  contextLine: { fontSize: 8, color: palette.muted, marginBottom: 8 },
  checklist: {
    marginTop: 18,
    borderRadius: 9,
    border: "1 solid #eadcc2",
    backgroundColor: palette.cream,
    padding: 16,
  },
  checkItem: { flexDirection: "row", gap: 8, marginTop: 5 },
  checkDot: { width: 10, color: palette.amber, fontSize: 10 },
  checkText: { flex: 1, fontSize: 8.2, color: palette.muted, lineHeight: 1.35 },
  pageTitle: { marginBottom: 20, paddingBottom: 14, borderBottom: `1 solid ${palette.line}` },
  pageTitleText: { fontFamily: "Times-Bold", fontSize: 24, color: palette.ink },
  pageSubtitle: { marginTop: 6, fontSize: 8.8, color: palette.muted },
  block: { marginBottom: 20 },
  scoreRow: { flexDirection: "row", alignItems: "center", marginTop: 11 },
  scoreLabel: { width: 92, fontSize: 8.6, color: palette.muted },
  scoreTrack: { flex: 1, height: 10, borderRadius: 4, backgroundColor: palette.wash, overflow: "hidden" },
  scoreBar: { height: 10, borderRadius: 4 },
  scoreValue: { width: 34, textAlign: "right", fontSize: 8.8, fontWeight: 700, color: palette.ink },
  highlightRow: {
    flexDirection: "row",
    border: `1 solid ${palette.line}`,
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  highlightIndex: { width: 32, color: palette.faint, fontWeight: 700, fontSize: 8 },
  highlightBody: { flex: 1 },
  highlightTitle: { fontSize: 9.3, fontWeight: 700, color: palette.ink },
  highlightMeta: { marginTop: 4, fontSize: 8, color: palette.muted },
  signalCard: {
    border: `1 solid ${palette.line}`,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
  },
  severityPill: {
    width: 58,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  severityPillText: { color: "#ffffff", fontSize: 7.4, fontWeight: 700 },
  signalBody: { flex: 1 },
  cardTitle: { fontFamily: "Times-Bold", fontSize: 11.2, color: palette.ink },
  cardMeta: { marginTop: 4, fontSize: 8, color: palette.muted },
  cardDescription: { marginTop: 8, fontSize: 8.4, color: palette.muted, lineHeight: 1.35 },
  impactBox: {
    width: 52,
    borderRadius: 7,
    backgroundColor: palette.wash,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  impactLabel: { color: palette.faint, fontSize: 6.8, fontWeight: 700, textTransform: "uppercase" },
  impactValue: { marginTop: 4, fontFamily: "Times-Bold", fontSize: 15, color: palette.ink },
  pairCard: {
    border: `1 solid ${palette.line}`,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    gap: 14,
    minHeight: 86,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#ffffff", fontFamily: "Times-Bold", fontSize: 16 },
  pairBody: { flex: 1 },
  reasonRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonPill: {
    maxWidth: 118,
    borderRadius: 6,
    backgroundColor: palette.wash,
    border: `1 solid ${palette.line}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 7.2,
    color: palette.muted,
  },
  evidenceCard: {
    border: `1 solid ${palette.line}`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 9,
    flexDirection: "row",
    gap: 12,
  },
  evidenceTag: {
    width: 50,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#e9f3ed",
    alignItems: "center",
    justifyContent: "center",
  },
  evidenceTagText: { color: palette.forest, fontSize: 7.5, fontWeight: 700 },
  evidenceBody: { flex: 1 },
  evidenceTitle: { fontSize: 9.5, fontWeight: 700, color: palette.ink },
  evidenceMeta: { marginTop: 4, fontSize: 7.4, color: palette.muted },
  evidenceSummary: { marginTop: 7, fontSize: 8, lineHeight: 1.3, color: palette.muted },
  methodology: { marginTop: 18, paddingTop: 12, borderTop: `1 solid ${palette.line}` },
  footer: {
    position: "absolute",
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    bottom: 22,
    paddingTop: 10,
    borderTop: `1 solid ${palette.line}`,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7.4, color: palette.muted },
});

function summarizeFindings(findings: ReportFinding[]): SignalGroup[] {
  const groups = new Map<string, SignalGroup>();

  for (const finding of findings) {
    const existing = groups.get(finding.title);
    if (!existing) {
      groups.set(finding.title, {
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        confidence: finding.confidence,
        scoreImpact: finding.scoreImpact,
        count: 1,
      });
      continue;
    }

    existing.count += 1;
    existing.scoreImpact += finding.scoreImpact;
    existing.severity = pickHigherSeverity(existing.severity, finding.severity);
    existing.confidence = pickHigherConfidence(existing.confidence, finding.confidence);
  }

  return [...groups.values()].sort((a, b) => b.scoreImpact - a.scoreImpact || b.count - a.count);
}

function buildExecutiveOverview(report: AnalysisReport, signals: SignalGroup[]): string[] {
  const metrics = report.metrics;
  const walletCount = metrics?.walletCount ?? countNodesByKind(report, "wallet");
  const contractCount = metrics?.contractCount ?? countNodesByKind(report, "contract");
  const edgeCount = metrics?.edgeCount ?? report.graph.edges.length;
  const watchedCount = metrics?.watchedAddressCount ?? "unknown";
  const eventCount = metrics?.eventCount ?? "unknown";
  const topSignal = signals[0];
  const pairCount = report.summary?.pairInsights?.length ?? 0;

  return [
    `This run produced a ${formatStrength(report.summary?.verdict ?? "none")} relationship verdict with a ${report.score.score}/100 relationship score and ${formatConfidence(report.score.confidence).toLowerCase()} confidence.${topSignal ? ` The leading signal family is ${formatPdfText(topSignal.title)} (${topSignal.count} hits).` : ""}`,
    `Scope covered ${watchedCount} watched wallets and ${eventCount} on-chain events across ${formatPdfText(report.meta?.chainName ?? report.scope ?? "the selected chain")}. Graph: ${walletCount} wallet nodes, ${contractCount} contract nodes, ${edgeCount} evidence edges.`,
    pairCount > 0
      ? `${pairCount} wallet pair insight${pairCount === 1 ? "" : "s"} require timing and intermediary-path review.`
      : "Review the evidence appendix before making attribution decisions.",
  ];
}

function countNodesByKind(report: AnalysisReport, kind: string): number {
  return report.graph.nodes.filter((node) => node.kind === kind).length;
}

function pickHigherSeverity(left: ReportFinding["severity"], right: ReportFinding["severity"]): ReportFinding["severity"] {
  const rank = { info: 0, low: 1, medium: 2, high: 3 } as const;
  return rank[right] > rank[left] ? right : left;
}

function pickHigherConfidence(
  left: ReportFinding["confidence"],
  right: ReportFinding["confidence"],
): ReportFinding["confidence"] {
  const rank = { low: 0, medium: 1, high: 2 } as const;
  return rank[right] > rank[left] ? right : left;
}

function formatChainShortNames(chainIds?: number[]): string {
  if (!chainIds?.length) {
    return "—";
  }

  const shortNames: Record<number, string> = {
    1: "ETH",
    42161: "ARB",
    8453: "BASE",
    10: "OP",
    137: "POLY",
    56: "BSC",
    101: "SOL",
  };

  return chainIds.map((chainId) => shortNames[chainId] ?? String(chainId)).join(" · ");
}

function formatStrength(value: string): string {
  if (value === "strong" || value === "强关联") return "Strong";
  if (value === "medium" || value === "中等关联") return "Moderate";
  if (value === "weak" || value === "弱关联") return "Weak";
  if (value === "none" || value === "无明显关联") return "None";
  return formatPdfText(value);
}

function formatSeverity(value: string): string {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";
  return "Info";
}

function formatConfidence(value: string): string {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  return "Low";
}

function strengthColor(value: string): string {
  if (value === "strong" || value === "强关联") return palette.green;
  if (value === "medium" || value === "中等关联") return palette.amber;
  if (value === "weak" || value === "弱关联") return palette.blue;
  return palette.muted;
}

function severityColor(value: ReportFinding["severity"]): string {
  if (value === "high") return palette.red;
  if (value === "medium") return palette.amber;
  if (value === "low") return palette.blue;
  return palette.muted;
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatPdfText(value);
  }

  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function uniqueFormatted(values: string[]): string[] {
  return [...new Set(values.map(formatPdfText).filter(Boolean))];
}

function formatPdfText(value: string): string {
  return translatePdfTerms(value)
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function translatePdfTerms(value: string): string {
  return value
    .replaceAll("强关联", "Strong relationship")
    .replaceAll("中等关联", "Moderate relationship")
    .replaceAll("弱关联", "Weak relationship")
    .replaceAll("无明显关联", "No clear relationship")
    .replaceAll("实时数据", "Live data")
    .replaceAll("本地样本", "Fixture data")
    .replaceAll("固定样本", "Fixture data")
    .replaceAll("·", "-");
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sideLength = Math.max(4, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, sideLength)}...${value.slice(-sideLength)}`;
}
