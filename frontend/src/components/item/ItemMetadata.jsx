import { MapPin, Calendar, Clock, School, UserCheck } from 'lucide-react'

export default function ItemMetadata({ item, isOwner }) {
  const isLost = item.type === 'LOST'
  const isFound = item.type === 'FOUND'

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A'
    try {
      const parts = dateStr.split('-')
      if (parts.length === 3) {
        const [y, m, d] = parts
        const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
        return dt.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      }
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  function getStatusClass(status) {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
      case 'AVAILABLE':
        return 'item-status-pill--active'
      case 'MATCHED':
        return 'item-status-pill--matched'
      case 'CLAIMED':
        return 'item-status-pill--claimed'
      case 'RECOVERED':
      case 'RETURNED':
        return 'item-status-pill--recovered'
      case 'CLOSED':
        return 'item-status-pill--closed'
      default:
        return 'item-status-pill--default'
    }
  }

  return (
    <div className="item-meta-container">
      {/* Badges Bar */}
      <div className="item-meta-badges">
        <span
          className={`item-type-pill ${
            isLost ? 'item-type-pill--lost' : 'item-type-pill--found'
          }`}
        >
          {isLost ? '🟠 LOST REPORT' : '🟢 FOUND REPORT'}
        </span>

        <span className="item-cat-pill">{item.category}</span>

        <span className={`item-status-pill ${getStatusClass(item.status)}`}>
          <span className="item-status-dot" />
          {item.status}
        </span>

        {isOwner && (
          <span className="item-owner-pill" title="You reported this item">
            <UserCheck size={12} />
            <span>Your Report</span>
          </span>
        )}
      </div>

      {/* Item Title */}
      <h1 className="item-detail-title">{item.title}</h1>

      {/* Structured Specifications Grid */}
      <div className="item-specs-grid">
        <div className="item-spec-cell">
          <div className="item-spec-label">
            <MapPin size={15} className="item-spec-icon" />
            <span>{isLost ? 'Last Seen Location' : 'Found At'}</span>
          </div>
          <div className="item-spec-value">{item.location}</div>
        </div>

        <div className="item-spec-cell">
          <div className="item-spec-label">
            <Calendar size={15} className="item-spec-icon" />
            <span>{isLost ? 'Date Lost' : 'Date Found'}</span>
          </div>
          <div className="item-spec-value">{formatDate(item.date)}</div>
        </div>

        {item.time && (
          <div className="item-spec-cell">
            <div className="item-spec-label">
              <Clock size={15} className="item-spec-icon" />
              <span>Approximate Time</span>
            </div>
            <div className="item-spec-value">{item.time}</div>
          </div>
        )}

        {item.campus && (
          <div className="item-spec-cell">
            <div className="item-spec-label">
              <School size={15} className="item-spec-icon" />
              <span>Campus Scope</span>
            </div>
            <div className="item-spec-value">{item.campus}</div>
          </div>
        )}
      </div>
    </div>
  )
}
