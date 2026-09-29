import { useState } from 'react'
import { Search, MapPin, Clock, Filter, Sparkles, CheckCircle2 } from 'lucide-react'
import './Subviews.css'

const CATEGORIES = ['All Categories', 'Bags', 'Electronics', 'ID Cards', 'Keys', 'Books', 'Other']

export default function ExploreView({
  activities = [],
  campus = '',
  onItemClick,
  onOpenReportModal,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // all, lost, found
  const [selectedCategory, setSelectedCategory] = useState('All Categories')

  const filteredItems = activities.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.detail.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || item.type === filterType

    return matchesSearch && matchesType
  })

  return (
    <div className="subview-container">
      <div className="subview-header">
        <div>
          <h2 className="subview-title">Campus Lost &amp; Found Directory</h2>
          <p className="subview-subtitle">
            Live public feed scoped exclusively to <strong>{campus?.trim() ? `📍 ${campus}` : 'your campus'}</strong>.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onOpenReportModal && onOpenReportModal('lost')}
        >
          + Report an Item
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="subview-controls">
        <div className="subview-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="subview-search-input"
            placeholder="Search by keyword, item name, or campus building..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="subview-type-tabs">
          <button
            type="button"
            className={`type-tab-btn ${filterType === 'all' ? 'type-tab-btn--active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Items
          </button>
          <button
            type="button"
            className={`type-tab-btn ${filterType === 'lost' ? 'type-tab-btn--active' : ''}`}
            onClick={() => setFilterType('lost')}
          >
            Lost Only
          </button>
          <button
            type="button"
            className={`type-tab-btn ${filterType === 'found' ? 'type-tab-btn--active' : ''}`}
            onClick={() => setFilterType('found')}
          >
            Found Only
          </button>
        </div>
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="empty-state-card" style={{ marginTop: '24px' }}>
          <div className="empty-state-card__icon">🔍</div>
          <h4 className="empty-state-card__title">No items found matching criteria</h4>
          <p className="empty-state-card__desc">
            Try adjusting your search terms or filters. New items are posted frequently by campus members.
          </p>
        </div>
      ) : (
        <div className="subview-grid">
          {filteredItems.map((item) => {
            const isFound = item.type === 'found'

            return (
              <div
                key={item.id}
                className={`subview-card ${isFound ? 'subview-card--found' : 'subview-card--lost'}`}
                onClick={() => onItemClick && onItemClick(item)}
              >
                <div className="subview-card__top">
                  <div className="subview-card__icon-box">{item.icon}</div>
                  <span className={`campus-type-pill ${isFound ? 'campus-type-pill--found' : 'campus-type-pill--lost'}`}>
                    {isFound ? 'Found' : 'Lost'}
                  </span>
                </div>

                <div className="subview-card__body">
                  <h4 className="subview-card__title">{item.title}</h4>
                  <div className="subview-card__loc">
                    <MapPin size={12} />
                    <span>{item.location}</span>
                  </div>
                  <p className="subview-card__detail">{item.detail}</p>
                </div>

                <div className="subview-card__footer">
                  <span className="subview-card__time">
                    <Clock size={12} /> {item.timeAgo}
                  </span>
                  <span className="subview-card__action">Inspect &rarr;</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
