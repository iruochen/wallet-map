import { notFound } from "next/navigation";
import { getLabelRepository } from "../../api/labels/label-storage";
import { LabelManager } from "../../../components/labels/label-manager";
import { readLabelManagerEnabled } from "../../../lib/feature-config";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  if (!readLabelManagerEnabled()) {
    notFound();
  }

  const repository = await getLabelRepository();
  const initialList = repository
    ? await repository.listKnownLabels({ limit: 20, offset: 0 }).catch(() => undefined)
    : undefined;

  return (
    <div className="historyPage labelPage">
      <section className="historyPanel labelPagePanel">
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
