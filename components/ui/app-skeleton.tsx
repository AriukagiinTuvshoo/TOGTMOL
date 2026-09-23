export function AppSkeleton() {
  return (
    <section
      className="card app-skeleton"
      role="status"
      aria-label="Тогтмол ачааллаж байна"
      aria-busy="true"
    >
      <div className="skeleton-head">
        <span className="skeleton-block skeleton-mark" />
        <div className="skeleton-copy">
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-line" />
        </div>
      </div>
      <div className="skeleton-metrics">
        {[1, 2, 3, 4].map((key) => (
          <span className="skeleton-block skeleton-metric" key={key} />
        ))}
      </div>
      <div className="skeleton-grid">
        <span className="skeleton-block skeleton-panel skeleton-panel-large" />
        <span className="skeleton-block skeleton-panel" />
      </div>
      <span className="sr-only">Өгөгдөл ачааллаж байна…</span>
    </section>
  );
}
