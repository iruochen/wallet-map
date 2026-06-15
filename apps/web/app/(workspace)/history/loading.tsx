export default function HistoryLoading() {
  return (
    <div className="historyPage historyRouteLoading" aria-label="Loading history">
      <section className="historyPanel">
        <div className="historyListBody historyListBodyEmpty">
          <div className="historyToolbar historyRouteLoadingToolbar">
            <div className="historyIdentity">
              <span className="historyRouteLoadingAvatar" aria-hidden="true" />
              <div className="historyRouteLoadingLines">
                <span />
                <span />
              </div>
            </div>
          </div>
          <div className="historyTableScroll historyTableScrollEmpty">
            <div className="historyEmpty historyRouteLoadingEmpty" aria-hidden="true">
              <span className="historyRouteLoadingIcon" />
              <span className="historyRouteLoadingTitle" />
              <span className="historyRouteLoadingBody" />
              <span className="historyRouteLoadingAction" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
