export default function Loading() {
  return (
    <div className="historyPage routeLoadingContent" aria-label="正在加载页面">
      <section className="historyPanel routeLoadingShell">
        <div className="routeLoadingToolbar">
          <span />
          <span />
          <span />
        </div>
        <div className="routeLoadingFilter">
          <span />
          <span />
          <span />
        </div>
        <div className="routeLoadingTable">
          <div className="routeLoadingTableHeader">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          {Array.from({ length: 7 }, (_, index) => (
            <div className="routeLoadingTableRow" key={index}>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
