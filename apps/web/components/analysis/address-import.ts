export interface AddressImportSummary {
  addresses: string[];
  validCount: number;
  duplicateCount: number;
  invalidRows: Array<{
    row: number;
    value: string;
  }>;
}

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;
const solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function parseAddressImport(input: string): AddressImportSummary {
  const seen = new Set<string>();
  const addresses: string[] = [];
  const invalidRows: AddressImportSummary["invalidRows"] = [];
  let duplicateCount = 0;

  input.split(/\r?\n/).forEach((line, index) => {
    const values = parseImportLine(line);

    for (const rawValue of values) {
      const value = rawValue.trim();

      if (!value) {
        continue;
      }

      const normalized = normalizeImportedAddress(value);

      if (!normalized) {
        invalidRows.push({ row: index + 1, value });
        continue;
      }

      if (seen.has(normalized)) {
        duplicateCount += 1;
        continue;
      }

      seen.add(normalized);
      addresses.push(normalized);
    }
  });

  return {
    addresses,
    validCount: addresses.length,
    duplicateCount,
    invalidRows,
  };
}

function normalizeImportedAddress(value: string): string | undefined {
  if (evmAddressPattern.test(value)) {
    return value.toLowerCase();
  }

  if (solanaAddressPattern.test(value)) {
    return value;
  }

  return undefined;
}

function parseImportLine(line: string): string[] {
  const trimmed = line.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/[,\t;\s]+/)
    .map((value) => value.trim().replace(/^"|"$/g, ""));
}
