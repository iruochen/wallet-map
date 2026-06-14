import { CheckCircle2, LockKeyhole } from "lucide-react";
import { getNextProductPlan, type ProductPlanSnapshot } from "../../../app/pro-plan";

interface PlanBoundaryProps {
  plan: ProductPlanSnapshot;
}

export function PlanBoundary({ plan }: PlanBoundaryProps) {
  const nextPlan = getNextProductPlan(plan.tier);

  return (
    <section className="planBoundary" aria-labelledby="plan-boundary-title">
      <div className="planBoundaryHeader">
        <div>
          <span className="panelEyebrow">Product boundary</span>
          <h3 id="plan-boundary-title">{plan.name}</h3>
          <p>{plan.summary}</p>
        </div>
        {nextPlan ? <span className="planBoundaryNext">Next: {nextPlan.name}</span> : null}
      </div>
      <div className="planCapabilityGrid" aria-label="当前版本能力">
        {plan.capabilities.map((capability) => (
          <div
            className={`planCapability ${capability.included ? "planCapabilityIncluded" : "planCapabilityLocked"}`}
            key={capability.id}
          >
            {capability.included ? (
              <CheckCircle2 aria-hidden="true" size={15} strokeWidth={2.2} />
            ) : (
              <LockKeyhole aria-hidden="true" size={15} strokeWidth={2.2} />
            )}
            <span>
              <strong>{capability.label}</strong>
              <small>{capability.value}</small>
            </span>
          </div>
        ))}
      </div>
      <p className="planBoundaryHint">{plan.upgradeHint}</p>
    </section>
  );
}
