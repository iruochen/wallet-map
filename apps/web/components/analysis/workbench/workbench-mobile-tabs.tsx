"use client";

import { FileSearch, Network, SlidersHorizontal } from "lucide-react";
import { useI18n } from "../../i18n/i18n-provider";

export type WorkbenchMobilePanel = "input" | "graph" | "evidence";

interface WorkbenchMobileTabsProps {
  activePanel: WorkbenchMobilePanel;
  onChange: (panel: WorkbenchMobilePanel) => void;
  findingsCount?: number;
  showEvidenceHint?: boolean;
  onDismissEvidenceHint?: () => void;
}

export function WorkbenchMobileTabs({
  activePanel,
  onChange,
  findingsCount = 0,
  showEvidenceHint = false,
  onDismissEvidenceHint,
}: WorkbenchMobileTabsProps) {
  const { t } = useI18n();

  return (
    <div className="workbenchMobileNavWrap">
      {showEvidenceHint ? (
        <button
          type="button"
          className="workbenchMobileHint"
          onClick={() => {
            onChange("evidence");
            onDismissEvidenceHint?.();
          }}
        >
          <span>{t("analysis.mobile.evidenceReady")}</span>
          <strong>{t("analysis.mobile.viewEvidence")}</strong>
        </button>
      ) : null}
      <nav className="workbenchMobileNav" aria-label={t("analysis.mobile.navAria")}>
        <button
          type="button"
          className={`workbenchMobileNavLink ${activePanel === "input" ? "workbenchMobileNavLinkActive" : ""}`}
          onClick={() => onChange("input")}
          aria-current={activePanel === "input" ? "page" : undefined}
        >
          <SlidersHorizontal size={17} strokeWidth={2.2} aria-hidden="true" />
          <span>{t("analysis.mobile.tab.input")}</span>
        </button>
        <button
          type="button"
          className={`workbenchMobileNavLink ${activePanel === "graph" ? "workbenchMobileNavLinkActive" : ""}`}
          onClick={() => onChange("graph")}
          aria-current={activePanel === "graph" ? "page" : undefined}
        >
          <Network size={17} strokeWidth={2.2} aria-hidden="true" />
          <span>{t("analysis.mobile.tab.graph")}</span>
        </button>
        <button
          type="button"
          className={`workbenchMobileNavLink ${activePanel === "evidence" ? "workbenchMobileNavLinkActive" : ""}`}
          onClick={() => onChange("evidence")}
          aria-current={activePanel === "evidence" ? "page" : undefined}
        >
          <FileSearch size={17} strokeWidth={2.2} aria-hidden="true" />
          <span className="workbenchMobileNavLabel">
            {t("analysis.mobile.tab.evidence")}
            {findingsCount > 0 ? (
              <span className="workbenchMobileNavBadge" aria-label={String(findingsCount)}>
                {findingsCount}
              </span>
            ) : null}
          </span>
        </button>
      </nav>
    </div>
  );
}
