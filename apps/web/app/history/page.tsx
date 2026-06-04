import { AppHeader, readLiveConfigured } from "../../components/layout/app-header";
import { HistoryJobList } from "../../components/history/history-job-list";

export default function HistoryPage() {
  const liveConfigured = readLiveConfigured();

  return (
    <div className="appShell">
      <AppHeader subtitle="历史分析记录" activeNav="history" liveConfigured={liveConfigured} />

      <main className="appMain historyPage">
        <section className="historyPanel">
          <div className="historyPanelHeader">
            <div>
              <span className="panelEyebrow">Analysis history</span>
              <h1>历史分析</h1>
              <p>查看已保存到 PostgreSQL 的分析任务，点击可回到工作台复盘结果。</p>
            </div>
          </div>
          <HistoryJobList />
        </section>
      </main>
    </div>
  );
}
