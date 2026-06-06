import type { AnalysisResponse } from "./analysis-types";

type ScoreDimensions = AnalysisResponse["score"]["dimensions"];
type ScoreDimensionKey = keyof ScoreDimensions;

const dimensionItems: Array<{
  key: ScoreDimensionKey;
  label: string;
  description: string;
}> = [
  { key: "funding", label: "Funding", description: "资金来源 / 多跳路径" },
  { key: "destination", label: "Destination", description: "共同去向 / 桥路径" },
  { key: "contract", label: "Contract", description: "共同合约交互" },
  { key: "temporal", label: "Time", description: "时间窗口重合" },
  { key: "asset", label: "Asset", description: "资产重合信号" },
];

interface ExposureScoreDimensionsProps {
  dimensions: ScoreDimensions;
  topSignals: string[];
}

export function ExposureScoreDimensions({
  dimensions,
  topSignals,
}: ExposureScoreDimensionsProps) {
  const strongestDimension = dimensionItems.reduce((strongest, item) =>
    dimensions[item.key] > dimensions[strongest.key] ? item : strongest,
  );

  return (
    <section className="exposureDimensions" aria-label="Exposure score dimensions">
      <header className="exposureDimensionsHeader">
        <div>
          <strong>Exposure dimensions</strong>
          <span>{strongestDimension.label} 维度最高</span>
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
              <p>{item.description}</p>
            </div>
          );
        })}
      </div>
      {topSignals.length > 0 ? (
        <div className="exposureTopSignals">
          <span>Top signals</span>
          <p>{topSignals.slice(0, 3).join(" · ")}</p>
        </div>
      ) : null}
    </section>
  );
}
