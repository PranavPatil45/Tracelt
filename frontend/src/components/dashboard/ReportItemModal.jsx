import { useState, useEffect } from 'react'
import { X, Search, PlusCircle, MapPin, Calendar, Tag, FileText, Check, AlertCircle } from 'lucide-react'
import './ReportItemModal.css'

const CATEGORIES = [
  'Bags & Backpacks',
  'Electronics & Gadgets',
  'Student IDs & Cards',
  'Keys & Access Badges',
  'Books & Notebooks',
  'Accessories & Eyewear',
  'Water Bottles',
  'Sports Equipment',
  'Other',
]

const LOCATIONS = [
  'Central Campus Library',
  'Engineering Block',
  'Student Center / Union',
  'Canteen & Dining Hall',
  'Science Quadrangle',
  'Sports Gymnasium',
  'Academic Lecture Hall Complex',
  'Campus Shuttle Stop',
  'Other Campus Area',
]

export default function ReportItemModal({
  isOpen,
  initialType = 'lost',
  onClose,
  onSubmitReport,
  campus = '',
}) {
  const [type, setType] = useState(initialType)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [location, setLocation] = useState(LOCATIONS[0])
  const [customLocation, setCustomLocation] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    setType(initialType)
    setSuccessMessage('')
  }, [initialType, isOpen])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isLost = type === 'lost'

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      const report = {
        id: `rep-${Date.now()}`,
        title: title.trim(),
        item: title.trim(),
        type: isLost ? 'Lost' : 'Found',
        category,
        location: location === 'Other Campus Area' ? customLocation : location,
        date: 'Just now',
        description,
        status: isLost ? 'Searching' : 'Active',
        statusColor: isLost ? 'amber' : 'cyan',
        icon: isLost ? '🎒' : '📦',
      }

      if (onSubmitReport) onSubmitReport(report)
      setSuccessMessage(
        isLost
          ? 'Lost item report published! Our scanning engine is monitoring campus submissions.'
          : 'Found item report published! Thank you for supporting the campus community.'
      )

      setTimeout(() => {
        onClose()
        setTitle('')
        setDescription('')
        setCustomLocation('')
        setSuccessMessage('')
      }, 1500)
    }, 600)
  }

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div
        className="report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <div className="report-modal__header">
          <div className="report-modal__type-switcher">
            <button
              type="button"
              className={`report-switch-btn ${isLost ? 'report-switch-btn--active-lost' : ''}`}
              onClick={() => setType('lost')}
            >
              <Search size={15} />
              <span>Report Lost Item</span>
            </button>

            <button
              type="button"
              className={`report-switch-btn ${!isLost ? 'report-switch-btn--active-found' : ''}`}
              onClick={() => setType('found')}
            >
              <PlusCircle size={15} />
              <span>Report Found Item</span>
            </button>
          </div>

          <button
            type="button"
            className="report-modal__close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="report-modal__campus-info">
          <MapPin size={13} className="campus-pin" />
          <span>This report will be scoped to <strong>{campus?.trim() ? campus : 'your campus'}</strong></span>
        </div>

        {successMessage ? (
          <div className="report-modal__success-screen">
            <div className="success-icon-wrap">
              <Check size={28} strokeWidth={3} />
            </div>
            <h3>Report Submitted Successfully</h3>
            <p>{successMessage}</p>
          </div>
        ) : (
          <form className="report-modal__form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="report-title">
                Item Title <span className="req">*</span>
              </label>
              <input
                id="report-title"
                type="text"
                className="modal-input"
                placeholder={isLost ? 'e.g. Matte Black Laptop Backpack' : 'e.g. Student ID Card found near Library'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="report-category">Category</label>
                <select
                  id="report-category"
                  className="modal-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="report-location">Campus Location</label>
                <select
                  id="report-location"
                  className="modal-select"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {location === 'Other Campus Area' && (
              <div className="form-group">
                <label htmlFor="report-custom-loc">Specific Location Details</label>
                <input
                  id="report-custom-loc"
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Bench outside Chemistry Wing, Floor 2"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="report-desc">
                Distinguishing Features &amp; Description
              </label>
              <textarea
                id="report-desc"
                className="modal-textarea"
                rows={3}
                placeholder={
                  isLost
                    ? 'Mention colors, stickers, brand marks, contents or lock codes to verify ownership.'
                    : 'Describe where item was found and where the owner can safely verify/collect it.'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="report-modal__footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={`btn ${isLost ? 'btn-primary' : 'btn-secondary'} report-modal__submit-btn`}
                disabled={submitting || !title.trim()}
              >
                {submitting ? 'Publishing report...' : isLost ? 'Start Campus Trace' : 'Publish Found Item'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
