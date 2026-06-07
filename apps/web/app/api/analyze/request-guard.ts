import type { ParsedAnalyzeRequest } from "./schema";
import {
  formatAddressCapacityError,
  getProductPlanLimits,
  type ProductPlanTier,
} from "../../pro-plan";

const defaultRequestBodyLimitBytes = 64 * 1024;

export async function readAnalyzeRequestBody(
  request: Request,
  maxBytes = defaultRequestBodyLimitBytes,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  const declaredLength = contentLength ? Number(contentLength) : undefined;

  if (declaredLength !== undefined && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(formatRequestSizeError(maxBytes));
  }

  const text = await request.text();
  const byteLength = new TextEncoder().encode(text).byteLength;

  if (byteLength > maxBytes) {
    throw new Error(formatRequestSizeError(maxBytes));
  }

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Analysis request body must be valid JSON.");
  }
}

export function assertAnalyzeRequestCapacity(
  parsed: ParsedAnalyzeRequest,
  tier: ProductPlanTier,
): void {
  const limits = getProductPlanLimits(tier);

  if (parsed.addresses.length > limits.maxAddresses) {
    throw new Error(formatAddressCapacityError(tier, parsed.addresses.length));
  }
}

function formatRequestSizeError(maxBytes: number): string {
  return `Analysis request body must be ${formatBytes(maxBytes)} or smaller.`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.floor(bytes / (1024 * 1024))} MB`;
  }

  return `${Math.floor(bytes / 1024)} KB`;
}
