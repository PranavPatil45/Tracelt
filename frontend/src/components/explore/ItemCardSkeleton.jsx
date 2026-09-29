import './ItemCard.css'

export default function ItemCardSkeleton() {
  return (
    <div className="explore-card explore-skeleton" aria-hidden="true">
      <div className="skeleton-media" />
      <div className="explore-card__body">
        <div className="skeleton-line skeleton-line--cat" />
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--meta" />
        <div className="skeleton-line skeleton-line--meta" style={{ width: '50%' }} />
        <div
          className="explore-card__footer"
          style={{ borderTop: '1px solid rgba(230, 236, 248, 0.05)', marginTop: '16px' }}
        >
          <div className="skeleton-line" style={{ width: '60px', height: '10px', margin: 0 }} />
          <div className="skeleton-line" style={{ width: '80px', height: '14px', margin: 0 }} />
        </div>
      </div>
    </div>
  )
}
