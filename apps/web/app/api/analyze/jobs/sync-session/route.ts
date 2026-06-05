import { getAnalysisStorage } from "../../analysis-storage";
import { readAnonymousSession, readWalletSession } from "../../../auth/session";

export async function POST(): Promise<Response> {
  const walletSession = await readWalletSession();

  if (!walletSession) {
    return Response.json({ error: "请先连接钱包并签名登录。" }, { status: 401 });
  }

  const anonymousSession = await readAnonymousSession();

  if (!anonymousSession) {
    return Response.json({ error: "当前浏览器没有可同步的会话记录。" }, { status: 400 });
  }

  const storage = await getAnalysisStorage();

  if (!storage) {
    return Response.json({ error: "历史存储未配置，无法同步会话记录。" }, { status: 503 });
  }

  try {
    const migratedCount = await storage.migrateSubjectJobs(
      anonymousSession.subjectId,
      walletSession.subjectId,
    );

    return Response.json({
      migratedCount,
      message:
        migratedCount > 0
          ? `已同步 ${migratedCount} 条会话分析到当前钱包。`
          : "没有可同步的会话分析记录。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync session history.";

    return Response.json({ error: message }, { status: 500 });
  }
}
