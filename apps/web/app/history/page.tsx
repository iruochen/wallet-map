import Link from "next/link";
import { HistoryJobList } from "../../components/history/history-job-list";

export default function HistoryPage() {
  return (
    <div className="appShell">
      <header className="appHeader" aria-label="Wallet Map header">
        <div className="appBrand">
          <span className="appBrandMark" aria-hidden="true">
            WM
          </span>
          <div className="appBrandText">
            <strong>Wallet Map</strong>
            <span>历史分析记录</span>
          </div>
        </div>
        <nav className="appHeaderNav" aria-label="主导航">
          <Link className="headerNavLink" href="/">
            工作台
          </Link>
          <Link className="headerNavLink headerNavLinkActive" href="/history">
            历史分析
          </Link>
        </nav>
      </header>

      <main className="historyPage">
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
