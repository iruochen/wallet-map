import { getLabelRepository } from "../../api/labels/label-storage";
import { LabelManager } from "../../../components/labels/label-manager";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const repository = await getLabelRepository();
  const initialList = repository
    ? await repository.listKnownLabels({ limit: 20, offset: 0 }).catch(() => undefined)
    : undefined;

  return (
    <div className="historyPage labelPage">
      <section className="historyPanel labelPagePanel">
        <div className="historyPanelHeader">
          <div>
            <span className="panelEyebrow">标签运营</span>
            <h1>本地标签库</h1>
            <p>查看分析沉淀的地址标签，并通过弹窗快速维护团队本地标签。</p>
          </div>
        </div>
        <div className="labelPageBody">
          <LabelManager
            initialLabels={initialList?.items ?? []}
            initialTotal={initialList?.total ?? 0}
            initialStats={initialList?.stats ?? { total: 0, local: 0, discovered: 0 }}
            initialStorageEnabled={Boolean(repository)}
          />
        </div>
      </section>
    </div>
  );
}
