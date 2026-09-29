export default function ItemDetailsSkeleton() {
  return (
    <div className="item-skeleton-container" aria-label="Loading item details">
      {/* Back link skeleton */}
      <div className="item-skeleton-bar item-skeleton-bar--back" />

      <div className="item-skeleton-grid">
        {/* Media Skeleton */}
        <div className="item-skeleton-media" />

        {/* Content Skeleton */}
        <div className="item-skeleton-content">
          <div className="item-skeleton-pills">
            <div className="item-skeleton-bar item-skeleton-bar--pill" />
            <div className="item-skeleton-bar item-skeleton-bar--pill" />
            <div className="item-skeleton-bar item-skeleton-bar--pill" />
          </div>

          <div className="item-skeleton-bar item-skeleton-bar--title" />
          <div className="item-skeleton-bar item-skeleton-bar--title-sub" />

          {/* Specs grid skeleton */}
          <div className="item-skeleton-specs">
            <div className="item-skeleton-spec-cell" />
            <div className="item-skeleton-spec-cell" />
            <div className="item-skeleton-spec-cell" />
            <div className="item-skeleton-spec-cell" />
          </div>

          {/* Description skeleton */}
          <div className="item-skeleton-desc" />

          {/* Actions skeleton */}
          <div className="item-skeleton-actions">
            <div className="item-skeleton-bar item-skeleton-bar--btn" />
            <div className="item-skeleton-bar item-skeleton-bar--btn" />
          </div>
        </div>
      </div>
    </div>
  )
}
