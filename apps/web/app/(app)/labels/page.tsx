import { getLabelRepository } from "../../api/labels/label-storage";
import { LabelManager } from "../../../components/labels/label-manager";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const repository = await getLabelRepository();
  const labels = repository
    ? await repository.listKnownLabels({ limit: 100 }).catch(() => [])
    : [];

  return (
    <div className="historyPage labelPage">
      <section className="historyPanel labelPagePanel">
        <div className="historyPanelHeader">
          <div>
            <span className="panelEyebrow">Label operations</span>
            <h1>本地标签库</h1>
            <p>管理团队自定义地址标签；分析任务会通过 PostgreSQL 标签提供器复用这些记录。</p>
          </div>
        </div>
        <LabelManager
          initialLabels={labels}
          initialStorageEnabled={Boolean(repository)}
        />
      </section>
    </div>
  );
}
