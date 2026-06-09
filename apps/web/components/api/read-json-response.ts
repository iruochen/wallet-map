export interface ApiErrorResponse {
  error?: string;
  message?: string;
}

export async function readJsonResponse<T extends object>(
  response: Response,
): Promise<T & ApiErrorResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      error: response.ok ? undefined : formatResponseError(response),
    } as T & ApiErrorResponse;
  }

  try {
    return JSON.parse(text) as T & ApiErrorResponse;
  } catch {
    return {
      error: response.ok
        ? "Server returned an invalid JSON response."
        : formatResponseError(response, text),
    } as T & ApiErrorResponse;
  }
}

function formatResponseError(response: Response, body?: string): string {
  const status = `${response.status} ${response.statusText || "Request failed"}`.trim();
  const snippet = body?.replace(/\s+/g, " ").trim().slice(0, 180);

  return snippet ? `${status}: ${snippet}` : status;
}
