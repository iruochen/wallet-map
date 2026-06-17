export type HistoryScopeOptionValue = "window" | "full";

export interface HistoryScopeOption {
  value: HistoryScopeOptionValue;
  historyDays?: number;
  labelKey:
    | "analysis.history.window90.label"
    | "analysis.history.window180.label"
    | "analysis.history.window365.label"
    | "analysis.history.window730.label"
    | "analysis.history.full.label";
  descriptionKey:
    | "analysis.history.window90.description"
    | "analysis.history.window180.description"
    | "analysis.history.window365.description"
    | "analysis.history.window730.description"
    | "analysis.history.full.description";
  helpAriaKey:
    | "analysis.history.window90.helpAria"
    | "analysis.history.window180.helpAria"
    | "analysis.history.window365.helpAria"
    | "analysis.history.window730.helpAria"
    | "analysis.history.full.helpAria";
}

export const historyScopeOptionDefinitions: HistoryScopeOption[] = [
  {
    value: "window",
    historyDays: 90,
    labelKey: "analysis.history.window90.label",
    descriptionKey: "analysis.history.window90.description",
    helpAriaKey: "analysis.history.window90.helpAria",
  },
  {
    value: "window",
    historyDays: 180,
    labelKey: "analysis.history.window180.label",
    descriptionKey: "analysis.history.window180.description",
    helpAriaKey: "analysis.history.window180.helpAria",
  },
  {
    value: "window",
    historyDays: 365,
    labelKey: "analysis.history.window365.label",
    descriptionKey: "analysis.history.window365.description",
    helpAriaKey: "analysis.history.window365.helpAria",
  },
  {
    value: "window",
    historyDays: 730,
    labelKey: "analysis.history.window730.label",
    descriptionKey: "analysis.history.window730.description",
    helpAriaKey: "analysis.history.window730.helpAria",
  },
  {
    value: "full",
    labelKey: "analysis.history.full.label",
    descriptionKey: "analysis.history.full.description",
    helpAriaKey: "analysis.history.full.helpAria",
  },
];

export const defaultHistoryScopeSelection = "window:365";

export function buildHistoryScopeSelectionKey(option: Pick<HistoryScopeOption, "value" | "historyDays">): string {
  if (option.value === "full") {
    return "full";
  }

  return `window:${option.historyDays ?? 365}`;
}

export function resolveHistoryScopeSelection(
  historyScope: HistoryScopeOptionValue,
  historyDays?: number,
): string {
  if (historyScope === "full") {
    return "full";
  }

  const days = historyDays ?? 365;
  const match = historyScopeOptionDefinitions.find(
    (option) => option.value === "window" && option.historyDays === days,
  );

  return match ? buildHistoryScopeSelectionKey(match) : defaultHistoryScopeSelection;
}

export function parseHistoryScopeSelection(selection: string): {
  historyScope: HistoryScopeOptionValue;
  historyDays?: number;
} {
  if (selection === "full") {
    return { historyScope: "full" };
  }

  const match = /^window:(\d+)$/.exec(selection);
  if (!match) {
    return { historyScope: "window", historyDays: 365 };
  }

  const historyDays = Number(match[1]);
  const known = historyScopeOptionDefinitions.some(
    (option) => option.value === "window" && option.historyDays === historyDays,
  );

  return {
    historyScope: "window",
    historyDays: known ? historyDays : 365,
  };
}
