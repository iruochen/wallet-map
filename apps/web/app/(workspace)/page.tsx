import { Suspense } from "react";
import { readAnonymousAnalysisQuota } from "../api/analyze/analysis-quota-guard";
import { readCurrentHistorySubject } from "../api/auth/session";
import { AnalysisWorkbench } from "../../components/analysis/analysis-workbench";
import { readLiveConfigured } from "../../components/layout/app-header";
import { supportedAnalysisChains } from "../chains";

export default async function HomePage() {
  const liveConfigured = readLiveConfigured();
  const initialAddresses = readInitialAddresses();
  const historySubject = await readCurrentHistorySubject();
  const anonymousAnalysisQuota = await readAnonymousAnalysisQuota(
    historySubject.subjectId,
    historySubject.mode,
  );
  return (
    <Suspense fallback={<WorkbenchLoadingFallback />}>
      <AnalysisWorkbench
        liveConfigured={liveConfigured}
        supportedChains={supportedAnalysisChains}
        initialAddresses={initialAddresses}
        anonymousAnalysisQuota={anonymousAnalysisQuota}
      />
    </Suspense>
  );
}

function WorkbenchLoadingFallback() {
  return (
    <section className="workbench workbenchLoadingShell" aria-label="正在加载工作台">
      <div className="workbenchColumn workbenchInput">
        <div className="workbenchColumnHeader workbenchLoadingHeader">
          <div>
            <span className="workbenchLoadingLine workbenchLoadingLineTitle" />
            <span className="workbenchLoadingLine workbenchLoadingLineShort" />
          </div>
        </div>
        <div className="workbenchInputBody">
          <div className="inputPanel workbenchLoadingCard">
            <span className="workbenchLoadingLine workbenchLoadingLineTitle" />
            <span className="workbenchLoadingBlock" />
            <span className="workbenchLoadingLine" />
            <span className="workbenchLoadingLine workbenchLoadingLineShort" />
          </div>
          <div className="summaryPanel workbenchLoadingCard">
            <span className="workbenchLoadingLine workbenchLoadingLineTitle" />
            <span className="workbenchLoadingLine" />
            <span className="workbenchLoadingLine workbenchLoadingLineShort" />
          </div>
        </div>
      </div>
      <div className="workbenchColumn workbenchGraph">
        <header className="workbenchColumnHeader workbenchLoadingHeader">
          <div>
            <span className="workbenchLoadingLine workbenchLoadingLineTitle" />
            <span className="workbenchLoadingLine workbenchLoadingLineShort" />
          </div>
        </header>
        <div className="workbenchGraphBody">
          <div className="workbenchLoadingGraph">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <div className="workbenchColumn workbenchFindings">
        <header className="workbenchColumnHeader workbenchFindingsHeader workbenchLoadingHeader">
          <div className="workbenchFindingsTitle">
            <span className="workbenchLoadingLine workbenchLoadingLineTitle" />
            <span className="workbenchLoadingLine workbenchLoadingLineShort" />
          </div>
        </header>
        <div className="workbenchScroll">
          <div className="loadingStack">
            <span className="workbenchLoadingBlock workbenchLoadingBlockTall" />
            <span className="workbenchLoadingBlock" />
            <span className="workbenchLoadingBlock" />
          </div>
        </div>
      </div>
    </section>
  );
}

function readInitialAddresses(): string | undefined {
  const raw = process.env.WALLET_MAP_DEFAULT_ADDRESSES?.trim();

  if (!raw) {
    return undefined;
  }

  return raw
    .split(/[,\s]+/)
    .map((address) => address.trim())
    .filter(Boolean)
    .join("\n");
}
