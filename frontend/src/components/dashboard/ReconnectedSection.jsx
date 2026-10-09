import { CheckCircle2, ArrowRight } from 'lucide-react'
import ItemThumbnail from './ItemThumbnail.jsx'
import './ReconnectedSection.css'

export default function ReconnectedSection({
  items = [],
  onViewDetails,
}) {
  if (items.length === 0) {
    return (
      <section className="reconnected-section" aria-label="Reconnected Items">
        <div className="section-title-row">
          <div>
            <h3 className="section-title">Recently Reconnected Items</h3>
            <p className="section-subtitle">Items returned safely to their owners.</p>
          </div>
        </div>

        <div className="empty-state-card">
          <div className="empty-state-card__icon-box">
            <CheckCircle2 size={28} strokeWidth={1.6} />
          </div>
          <h4 className="empty-state-card__title">No recovered items yet</h4>
          <p className="empty-state-card__desc">
            When a lost item report is matched and confirmed returned, it will be recorded here.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="reconnected-section" aria-label="Reconnected Items">
      <div className="section-title-row">
        <div>
          <h3 className="section-title">Recently Reconnected Items</h3>
          <p className="section-subtitle">
            Items safely returned to verified owners across campus.
          </p>
        </div>
      </div>

      <div className="reconnected-grid">
        {items.map((item) => (
          <div key={item.id} className="reconnected-card">
            <div className="reconnected-card__header">
              <div className="reconnected-card__icon-box">
                <ItemThumbnail
                  src={item.image_url || item.imageUrl}
                  alt={item.title}
                  fallbackIconSize={20}
                />
              </div>
              <div className="reconnected-card__info">
                <h4 className="reconnected-card__title">{item.title}</h4>
                <span className="reconnected-card__badge">
                  <CheckCircle2 size={12} /> {item.status}
                </span>
              </div>
            </div>

            <div className="reconnected-card__journey">
              <div className="journey-step">
                <span className="journey-step__label">Lost</span>
                <span className="journey-step__loc">{item.lostLocation}</span>
              </div>
              <div className="journey-arrow">&rarr;</div>
              <div className="journey-step">
                <span className="journey-step__label">Matched</span>
                <span className="journey-step__loc">{item.matchedLocation}</span>
              </div>
            </div>

            <div className="reconnected-card__footer">
              <span className="reconnected-card__founder">{item.founder}</span>
              <button
                type="button"
                className="reconnected-card__action"
                onClick={() => onViewDetails && onViewDetails(item)}
              >
                <span>View Details</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
