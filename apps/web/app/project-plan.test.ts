import { describe, expect, it } from "vitest";
import { roadmapItems } from "./project-plan";

describe("project plan", () => {
  it("keeps the first-stage checklist focused on analysis workflow", () => {
    expect(roadmapItems).toContain("输入 2 到 N 个钱包地址");
    expect(roadmapItems).toContain("输出证据、评分和报告");
  });
});
