import { HistoryJobList } from "../../../components/history/history-job-list";
import { readWalletSession } from "../../api/auth/session";

export default async function HistoryPage() {
  const walletSession = await readWalletSession();

  return (
    <div className="historyPage">
      <section className="historyPanel">
        <HistoryJobList
          initialHistoryMode={walletSession ? "wallet" : "session"}
          initialWalletAddress={walletSession?.address}
        />
      </section>
    </div>
  );
}
