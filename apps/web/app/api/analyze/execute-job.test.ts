import { describe, expect, it } from "vitest";
import { executeAnalyzeJob } from "./execute-job";
import { createAnalyzeJob, getAnalyzeJob, resetAnalyzeJobStoreForTests } from "./job-store";

describe("executeAnalyzeJob", () => {
  it("runs fixture analysis with staged progress", async () => {
    resetAnalyzeJobStoreForTests();
    const jobId = "job-test-fixture";
    await createAnalyzeJob(jobId);

    await executeAnalyzeJob(jobId, {
      addresses: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
      chainId: 1,
      chainIds: [1],
      dataMode: "fixture",
      dataProvider: "auto",
    });

    const job = await getAnalyzeJob(jobId);
    const result = job?.result as
      | {
          graph?: {
            totalNodes: number;
            totalEdges: number;
          };
          graphView?: {
            schemaVersion: string;
            totalNodes: number;
            totalEdges: number;
            summary: {
              nodeCount: number;
              edgeCount: number;
            };
          };
        }
      | undefined;

    expect(job?.status).toBe("completed");
    expect(job?.progress.completedPhases).toEqual(["fetch", "graph", "labels", "analysis"]);
    expect(result?.graphView).toMatchObject({
      schemaVersion: "1.0",
      totalNodes: result?.graph?.totalNodes,
      totalEdges: result?.graph?.totalEdges,
      summary: {
        nodeCount: result?.graph?.totalNodes,
        edgeCount: result?.graph?.totalEdges,
      },
    });
  });
});
