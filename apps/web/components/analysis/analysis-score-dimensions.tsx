import type { I18nKey } from "../i18n/i18n-provider";
import { useI18n } from "../i18n/i18n-provider";
import type { AnalysisResponse } from "./analysis-types";

type ScoreDimensions = AnalysisResponse["score"]["dimensions"];
type ScoreDimensionKey = keyof ScoreDimensions;

const dimensionItems: Array<{
  key: ScoreDimensionKey;
  labelKey: I18nKey;
}> = [
  { key: "funding", labelKey: "analysis.exposure.dimension.funding" },
  { key: "destination", labelKey: "analysis.exposure.dimension.destination" },
  { key: "contract", labelKey: "analysis.exposure.dimension.contract" },
  { key: "temporal", labelKey: "analysis.exposure.dimension.temporal" },
  { key: "asset", labelKey: "analysis.exposure.dimension.asset" },
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
          <span>{t("analysis.exposure.strongest", { label: t(strongestDimension.labelKey) })}</span>
        </div>
        <span>{dimensions[strongestDimension.key]}/100</span>
      </header>
      <div className="exposureDimensionList">
        {dimensionItems.map((item) => {
          const value = dimensions[item.key];

          return (
            <div key={item.key} className="exposureDimensionItem">
              <div className="exposureDimensionLabel">
                <strong>{t(item.labelKey)}</strong>
                <span>{value}</span>
              </div>
              <div className="exposureDimensionTrack" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
              </div>
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
