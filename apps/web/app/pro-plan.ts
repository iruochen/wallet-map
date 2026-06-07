export type ProductPlanTier = "anonymous" | "free" | "pro" | "team";

export interface ProductPlanCapability {
  id: "address-capacity" | "history-retention" | "exports" | "providers" | "labels";
  label: string;
  value: string;
  included: boolean;
}

export interface ProductPlanSnapshot {
  tier: ProductPlanTier;
  name: string;
  summary: string;
  upgradeHint: string;
  capabilities: ProductPlanCapability[];
}

interface BuildProductPlanInput {
  authenticated: boolean;
  anonymousAnalysisQuota?: {
    limit: number;
    used: number;
    remaining: number;
  } | null;
}

const planOrder: ProductPlanTier[] = ["anonymous", "free", "pro", "team"];

export const productPlanCatalog: Record<ProductPlanTier, ProductPlanSnapshot> = {
  anonymous: {
    tier: "anonymous",
    name: "Anonymous",
    summary: "Session-scoped trial with limited history.",
    upgradeHint: "Connect wallet for durable history; Pro expands capacity, exports, and provider depth.",
    capabilities: [
      { id: "address-capacity", label: "Address capacity", value: "Small fixture/live runs", included: true },
      { id: "history-retention", label: "History", value: "Browser session", included: true },
      { id: "exports", label: "Exports", value: "Basic report formats", included: true },
      { id: "providers", label: "Live providers", value: "Configured local keys", included: false },
      { id: "labels", label: "Team labels", value: "Read-only local enrichment", included: false },
    ],
  },
  free: {
    tier: "free",
    name: "Free",
    summary: "Signed-in personal workspace for repeat audits.",
    upgradeHint: "Pro unlocks larger batches, longer history, deeper live providers, and report templates.",
    capabilities: [
      { id: "address-capacity", label: "Address capacity", value: "Standard wallet groups", included: true },
      { id: "history-retention", label: "History", value: "Wallet-scoped replay", included: true },
      { id: "exports", label: "Exports", value: "PDF, Markdown, JSON, CSV", included: true },
      { id: "providers", label: "Live providers", value: "Single configured provider path", included: true },
      { id: "labels", label: "Team labels", value: "Personal local labels", included: false },
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    summary: "High-capacity investigations with deeper analysis.",
    upgradeHint: "Team adds shared labels, review workflows, and private deployment boundaries.",
    capabilities: [
      { id: "address-capacity", label: "Address capacity", value: "Large async batches", included: true },
      { id: "history-retention", label: "History", value: "Extended job archive", included: true },
      { id: "exports", label: "Exports", value: "Report templates and evidence packs", included: true },
      { id: "providers", label: "Live providers", value: "Multi-provider fallback", included: true },
      { id: "labels", label: "Team labels", value: "Private label sets", included: true },
    ],
  },
  team: {
    tier: "team",
    name: "Team",
    summary: "Collaborative review and deployment control.",
    upgradeHint: "Designed for shared review, managed retention, and audit operations.",
    capabilities: [
      { id: "address-capacity", label: "Address capacity", value: "Managed team limits", included: true },
      { id: "history-retention", label: "History", value: "Shared retention policy", included: true },
      { id: "exports", label: "Exports", value: "Review-ready report workspace", included: true },
      { id: "providers", label: "Live providers", value: "Managed provider pool", included: true },
      { id: "labels", label: "Team labels", value: "Shared label governance", included: true },
    ],
  },
};

export function buildProductPlanSnapshot(input: BuildProductPlanInput): ProductPlanSnapshot {
  const base = clonePlan(input.authenticated ? productPlanCatalog.free : productPlanCatalog.anonymous);

  if (base.tier === "anonymous" && input.anonymousAnalysisQuota) {
    return {
      ...base,
      summary: `Session trial: ${input.anonymousAnalysisQuota.remaining} of ${input.anonymousAnalysisQuota.limit} analyses left.`,
    };
  }

  return base;
}

export function getNextProductPlan(tier: ProductPlanTier): ProductPlanSnapshot | null {
  const index = planOrder.indexOf(tier);
  const nextTier = planOrder[index + 1];
  return nextTier ? clonePlan(productPlanCatalog[nextTier]) : null;
}

export function formatPlanCapabilitySummary(plan: ProductPlanSnapshot): string {
  const enabled = plan.capabilities
    .filter((capability) => capability.included)
    .map((capability) => capability.label);

  return enabled.length > 0 ? enabled.join(" · ") : "No enabled capabilities";
}

function clonePlan(plan: ProductPlanSnapshot): ProductPlanSnapshot {
  return {
    ...plan,
    capabilities: plan.capabilities.map((capability) => ({ ...capability })),
  };
}
