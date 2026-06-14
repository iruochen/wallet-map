import { beforeEach, describe, expect, it, vi } from "vitest";
import { after } from "next/server";
import { POST } from "./route";
import { createAnalyzeJobId, executeAnalyzeJob, initializeAnalyzeJobRecord } from "./execute-job";
import { getCurrentHistorySubject } from "../auth/session";

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => unknown) => {
    void callback();
  }),
}));

vi.mock("./execute-job", () => ({
  createAnalyzeJobId: vi.fn(() => "job:test"),
  executeAnalyzeJob: vi.fn(async () => undefined),
  initializeAnalyzeJobRecord: vi.fn(async () => undefined),
}));

vi.mock("./analysis-quota-guard", () => ({
  assertAnonymousAnalysisAllowed: vi.fn(async () => undefined),
}));

vi.mock("../auth/session", () => ({
  getCurrentHistorySubject: vi.fn(async () => ({
    subjectId: "session:test",
    mode: "session",
  })),
}));

const createAnalyzeJobIdMock = vi.mocked(createAnalyzeJobId);
const executeAnalyzeJobMock = vi.mocked(executeAnalyzeJob);
const initializeAnalyzeJobRecordMock = vi.mocked(initializeAnalyzeJobRecord);
const getCurrentHistorySubjectMock = vi.mocked(getCurrentHistorySubject);
const afterMock = vi.mocked(after);

describe("POST /api/analyze", () => {
  beforeEach(() => {
    createAnalyzeJobIdMock.mockClear();
    executeAnalyzeJobMock.mockClear();
    initializeAnalyzeJobRecordMock.mockClear();
    afterMock.mockClear();
    getCurrentHistorySubjectMock.mockResolvedValue({
      subjectId: "session:test",
      mode: "session",
    });
  });

  it("rejects anonymous requests over the plan address limit", async () => {
    const response = await POST(buildAnalyzeRequest(buildAddresses(11)));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Anonymous plan supports up to 10 addresses");
    expect(createAnalyzeJobIdMock).not.toHaveBeenCalled();
    expect(initializeAnalyzeJobRecordMock).not.toHaveBeenCalled();
    expect(executeAnalyzeJobMock).not.toHaveBeenCalled();
  });

  it("accepts signed-in requests within the free plan address limit", async () => {
    getCurrentHistorySubjectMock.mockResolvedValue({
      subjectId: "wallet:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      mode: "wallet",
      session: {
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        subjectId: "wallet:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    });

    const response = await POST(buildAnalyzeRequest(buildAddresses(25)));
    const body = (await response.json()) as { jobId?: string };

    expect(response.status).toBe(202);
    expect(body.jobId).toBe("job:test");
    expect(createAnalyzeJobIdMock).toHaveBeenCalledOnce();
    expect(initializeAnalyzeJobRecordMock).toHaveBeenCalledOnce();
    expect(executeAnalyzeJobMock).toHaveBeenCalledOnce();
    expect(afterMock).not.toHaveBeenCalled();
  });
});

function buildAnalyzeRequest(addresses: string[]): Request {
  return new Request("https://wallet-map.test/api/analyze", {
    method: "POST",
    body: JSON.stringify({
      addresses,
      chainId: 1,
      dataMode: "fixture",
    }),
  });
}

function buildAddresses(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `0x${(index + 1).toString(16).padStart(40, "a")}`,
  );
}
