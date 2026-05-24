import { DirectTransferAnalyzer } from "@wallet-map/analyzers";
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

      <section className="workspace">
        <form className="inputPanel">
          <label htmlFor="addresses">钱包地址</label>
          <textarea
            id="addresses"
            name="addresses"
            placeholder={"0x...\n0x...\n0x..."}
            rows={8}
          />
          <div className="formRow">
            <label>
              链
              <select defaultValue="1" name="chainId">
                <option value="1">Ethereum</option>
                <option value="42161">Arbitrum</option>
                <option value="8453">Base</option>
                <option value="56">BSC</option>
              </select>
            </label>
            <label>
              时间范围
              <select defaultValue="90d" name="range">
                <option value="30d">30 天</option>
                <option value="90d">90 天</option>
                <option value="all">全部</option>
              </select>
            </label>
          </div>
          <button type="button">生成分析任务</button>
        </form>

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
      </section>
    </main>
  );
}
