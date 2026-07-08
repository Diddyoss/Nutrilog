/** Shimmering placeholder block; size it inline where it's used. */
export function Skeleton({ width, height }: { width?: string; height?: string }) {
  return <div className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

/** Placeholder for a meal-section card while the food log loads. */
export function MealSectionSkeleton() {
  return (
    <section className="card meal-section" aria-hidden="true">
      <div className="skeleton-row">
        <Skeleton width="30%" height="16px" />
        <Skeleton width="52px" height="12px" />
      </div>
      <div className="skeleton-row">
        <Skeleton width="65%" height="12px" />
      </div>
      <div className="skeleton-row">
        <Skeleton width="45%" height="12px" />
      </div>
    </section>
  );
}
