import { useState } from 'react'
import { MapPin, Calendar, ArrowRight, PackageSearch, PackageCheck } from 'lucide-react'
import ItemThumbnail from '../ItemThumbnail.jsx'
import './Subviews.css'

export default function MyItemsView({
  initialType = 'lost', // 'lost' | 'found'
  reports = [],
  onOpenReportModal,
  onViewReport,
}) {
  const [activeTab, setActiveTab] = useState(initialType)

  const items = reports.filter((r) => r.type.toLowerCase() === activeTab.toLowerCase())

  return (
    <div className="subview-container">
      <div className="subview-header">
        <div>
          <h2 className="subview-title">
            {activeTab === 'lost' ? 'My Lost Item Reports' : 'My Found Item Reports'}
          </h2>
          <p className="subview-subtitle">
            Manage reports you created and track ongoing scanning status.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onOpenReportModal && onOpenReportModal(activeTab)}
        >
          {activeTab === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
        </button>
      </div>

      <div className="subview-type-tabs" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={`type-tab-btn ${activeTab === 'lost' ? 'type-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('lost')}
        >
          Lost Items ({reports.filter((r) => r.type.toLowerCase() === 'lost').length})
        </button>

        <button
          type="button"
          className={`type-tab-btn ${activeTab === 'found' ? 'type-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('found')}
        >
          Found Items ({reports.filter((r) => r.type.toLowerCase() === 'found').length})
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-card__icon-box">
            {activeTab === 'lost' ? (
              <PackageSearch size={28} strokeWidth={1.6} />
            ) : (
              <PackageCheck size={28} strokeWidth={1.6} />
            )}
          </div>
          <h4 className="empty-state-card__title">
            {activeTab === 'lost' ? 'No Lost Items' : 'No Found Items'}
          </h4>
          <p className="empty-state-card__desc">
            {activeTab === 'lost'
              ? "You haven't reported anything lost yet."
              : "Help someone by reporting an item you've found."}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onOpenReportModal && onOpenReportModal(activeTab)}
          >
            {activeTab === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
          </button>
        </div>
      ) : (
        <div className="subview-grid">
          {items.map((item) => (
            <div key={item.id} className="subview-card">
              <div className="subview-card__top">
                <div className="subview-card__icon-box">
                  <ItemThumbnail
                    src={item.image_url || item.imageUrl}
                    alt={item.item}
                    fallbackIconSize={20}
                  />
                </div>
                <span className={`report-status-badge report-status-badge--${item.statusColor}`}>
                  <span className="status-badge-dot" />
                  {item.status}
                </span>
              </div>

              <div className="subview-card__body">
                <h4 className="subview-card__title">{item.item}</h4>
                <div className="subview-card__loc">
                  <MapPin size={12} />
                  <span>{item.location}</span>
                </div>
              </div>

              <div className="subview-card__footer">
                <span className="subview-card__time">
                  <Calendar size={12} /> {item.date}
                </span>
                <button
                  type="button"
                  className="reports-view-action"
                  onClick={() => onViewReport && onViewReport(item)}
                >
                  <span>Details</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
