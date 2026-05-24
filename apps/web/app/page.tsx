import { DirectTransferAnalyzer } from "@wallet-map/analyzers";
import { AnalysisWorkbench } from "./analysis-workbench";
import { roadmapItems } from "./project-plan";

const analyzer = new DirectTransferAnalyzer();

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Wallet Map</p>
          <h1>钱包关联分析工作台</h1>
          <p className="lede">
            本地优先地分析多个钱包之间的转账、共同交互、路径关系和证据明细。
          </p>
        </div>
        <div className="statusPanel" aria-label="Project status">
          <span>First analyzer</span>
          <strong>{analyzer.name}</strong>
        </div>
      </section>

      <AnalysisWorkbench />

      <aside className="checklist">
        <h2>第一阶段清单</h2>
        <ul>
          {roadmapItems.map((item) => (
            <li key={item}>
              <span aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
