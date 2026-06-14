import { useI18n, type I18nKey } from "../i18n/i18n-provider";
import type { AnalysisResponse } from "./analysis-types";

type ScoreDimensions = AnalysisResponse["score"]["dimensions"];
type ScoreDimensionKey = keyof ScoreDimensions;

const dimensionItems: Array<{
  key: ScoreDimensionKey;
  label: string;
  descriptionKey: I18nKey;
}> = [
  { key: "funding", label: "Funding", descriptionKey: "analysis.exposure.funding.description" },
  { key: "destination", label: "Destination", descriptionKey: "analysis.exposure.destination.description" },
  { key: "contract", label: "Contract", descriptionKey: "analysis.exposure.contract.description" },
  { key: "temporal", label: "Time", descriptionKey: "analysis.exposure.temporal.description" },
  { key: "asset", label: "Asset", descriptionKey: "analysis.exposure.asset.description" },
];

interface ExposureScoreDimensionsProps {
  dimensions: ScoreDimensions;
  topSignals: string[];
}

export function ExposureScoreDimensions({
  dimensions,
  topSignals,
}: ExposureScoreDimensionsProps) {
  const { t } = useI18n();
  const strongestDimension = dimensionItems.reduce((strongest, item) =>
    dimensions[item.key] > dimensions[strongest.key] ? item : strongest,
  );

  return (
    <section className="exposureDimensions" aria-label={t("analysis.exposure.title")}>
      <header className="exposureDimensionsHeader">
        <div>
          <strong>{t("analysis.exposure.title")}</strong>
          <span>{t("analysis.exposure.strongest", { label: strongestDimension.label })}</span>
        </div>
        <span>{dimensions[strongestDimension.key]}/100</span>
      </header>
      <div className="exposureDimensionList">
        {dimensionItems.map((item) => {
          const value = dimensions[item.key];

          return (
            <div key={item.key} className="exposureDimensionItem">
              <div className="exposureDimensionLabel">
                <strong>{item.label}</strong>
                <span>{value}</span>
              </div>
              <div className="exposureDimensionTrack" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
              </div>
              <p>{t(item.descriptionKey)}</p>
            </div>
          );
        })}
      </div>
      {topSignals.length > 0 ? (
        <div className="exposureTopSignals">
          <span>{t("analysis.exposure.topSignals")}</span>
          <p>{topSignals.slice(0, 3).join(" · ")}</p>
        </div>
      ) : null}
    </section>
  );
}
