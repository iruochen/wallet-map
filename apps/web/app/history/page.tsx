import { AppHeader } from "../../components/layout/app-header";
import { HistoryJobList } from "../../components/history/history-job-list";
import { readWalletSession } from "../api/auth/session";

export default async function HistoryPage() {
  const walletSession = await readWalletSession();

  return (
    <div className="appShell">
      <AppHeader subtitle="历史分析记录" activeNav="history" />

      <main className="appMain historyPage">
        <section className="historyPanel">
          <div className="historyPanelHeader">
            <div>
              <span className="panelEyebrow">Analysis history</span>
              <h1>历史分析</h1>
              <p>登录钱包后查看持久化记录；未登录时显示本次会话历史。</p>
            </div>
          </div>
          <HistoryJobList
            initialHistoryMode={walletSession ? "wallet" : "session"}
            initialWalletAddress={walletSession?.address}
          />
        </section>
      </main>
    </div>
  );
}
