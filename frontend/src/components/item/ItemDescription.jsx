import { AlignLeft } from 'lucide-react'

export default function ItemDescription({ description }) {
  return (
    <section className="item-desc-section" aria-labelledby="item-description-heading">
      <div className="item-desc-header">
        <AlignLeft size={16} className="item-desc-icon" />
        <h2 id="item-description-heading" className="item-desc-title">
          About this item
        </h2>
      </div>

      <div className="item-desc-body">
        {description ? (
          <p className="item-desc-text">{description}</p>
        ) : (
          <p className="item-desc-text item-desc-text--empty">
            No additional description provided for this report.
          </p>
        )}
      </div>
    </section>
  )
}
