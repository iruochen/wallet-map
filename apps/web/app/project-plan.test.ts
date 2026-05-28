import { describe, expect, it } from "vitest";
import { roadmapItems } from "./project-plan";

describe("project plan", () => {
  it("keeps the roadmap focused on analysis workflow and next product steps", () => {
    expect(roadmapItems.some((item) => item.includes("批量导入 2 到 N 个钱包地址"))).toBe(true);
    expect(roadmapItems.some((item) => item.includes("输出证据、评分和 Markdown 报告"))).toBe(true);
    expect(roadmapItems.some((item) => item.includes("跨链桥"))).toBe(true);
  });
});
