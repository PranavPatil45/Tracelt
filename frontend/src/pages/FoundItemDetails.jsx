import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Tag,
  ShieldCheck,
  Edit,
  Trash2,
  AlertCircle,
  Package,
  CheckCircle2,
  X,
  Loader2,
  HeartHandshake,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import { getFoundItemById, updateFoundItem, deleteFoundItem } from '../api/foundItems.js'
import { LOST_ITEM_CATEGORIES, CAMPUS_LOCATIONS } from '../data/lostItemOptions.js'
import { getItemImageUrl } from '../utils/imageUrl.js'
import './FoundItemDetails.css'

export default function FoundItemDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, token, loading, logout, isAuthenticated } = useAuth()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [item, setItem] = useState(null)
  const [loadingItem, setLoadingItem] = useState(true)
  const [error, setError] = useState('')
  const [imgError, setImgError] = useState(false)

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStatus, setEditStatus] = useState('AVAILABLE')
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [loading, isAuthenticated, navigate])

  const loadItem = useCallback(async () => {
    setLoadingItem(true)
    setError('')
    try {
      const data = await getFoundItemById(id, token)
      setItem(data)
      setEditTitle(data.title)
      setEditCategory(data.category)
      setEditDescription(data.description)
      setEditLocation(data.location)
      setEditStatus(data.status || 'AVAILABLE')
    } catch (err) {
      setError(err.message || 'Found item not found.')
    } finally {
      setLoadingItem(false)
    }
  }, [id, token])

  useEffect(() => {
    if (isAuthenticated && id) {
      loadItem()
    }
  }, [isAuthenticated, id, loadItem])

  const isOwner = Boolean(user && item && user.id === item.user_id)

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editTitle.trim() || !editDescription.trim()) {
      setEditError('Title and description cannot be empty.')
      return
    }

    setUpdating(true)
    setEditError('')
    try {
      const updated = await updateFoundItem(
        id,
        {
          title: editTitle.trim(),
          category: editCategory,
          description: editDescription.trim(),
          location: editLocation,
          status: editStatus,
        },
        token
      )
      setItem(updated)
      setEditModalOpen(false)
    } catch (err) {
      setEditError(err.message || 'Failed to update report.')
    } finally {
      setUpdating(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    try {
      await deleteFoundItem(id, token)
      navigate('/my-found-items')
    } catch (err) {
      alert(err.message || 'Failed to delete report.')
      setDeleting(false)
    }
  }

  function getStatusClass(status) {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return 'found-status-pill--available'
      case 'MATCHED':
        return 'found-status-pill--matched'
      case 'CLAIMED':
        return 'found-status-pill--claimed'
      case 'RETURNED':
        return 'found-status-pill--returned'
      case 'CLOSED':
        return 'found-status-pill--closed'
      default:
        return 'found-status-pill--available'
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading item details&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="dashboard-app">
      {/* Sidebar */}
      <Sidebar
        activeTab="found-items"
        setActiveTab={(tab) => {
          navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)
        }}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Area */}
      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Found Item Details"
          user={user}
          logout={logout}
          onOpenNotifications={() => navigate('/dashboard')}
          onOpenReportModal={(type) => {
            if (type === 'lost') navigate('/report-lost')
            else navigate('/report-found')
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content">
          <div className="item-details-container">
            <div className="item-details-back">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="report-back-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <ArrowLeft size={16} /> Back to Reports
              </button>
            </div>

            {loadingItem ? (
              <div className="my-found-loading">
                <Loader2 size={32} className="animate-spin" />
                <p>Loading report details&hellip;</p>
              </div>
            ) : error ? (
              <div className="report-server-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            ) : item ? (
              <article className="item-details-card">
                <div className="item-details-grid">
                  {/* Left Column: Large Image or Placeholder */}
                  <div className="item-details-media">
                    {getItemImageUrl(item.image_url) && !imgError ? (
                      <img
                        src={getItemImageUrl(item.image_url)}
                        alt={item.title}
                        className="item-details-img"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className="item-details-no-img">
                        <Package size={56} />
                        <span>{imgError ? 'Image could not be loaded' : 'No photo provided by finder'}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Full Details */}
                  <div className="item-details-info">
                    <div className="item-details-top">
                      <span className="item-details-category">{item.category}</span>
                      <span className={`found-status-pill ${getStatusClass(item.status)}`}>
                        ● {item.status || 'AVAILABLE'}
                      </span>
                    </div>

                    <h1 className="item-details-title">{item.title}</h1>

                    <div className="item-details-specs">
                      <div className="item-spec-row">
                        <div className="item-spec-label">
                          <MapPin size={15} /> Found Location
                        </div>
                        <div className="item-spec-val">
                          {item.location} {item.campus ? `(${item.campus})` : ''}
                        </div>
                      </div>

                      <div className="item-spec-row">
                        <div className="item-spec-label">
                          <Calendar size={15} /> Date Found
                        </div>
                        <div className="item-spec-val">{item.found_date}</div>
                      </div>

                      {item.found_time && (
                        <div className="item-spec-row">
                          <div className="item-spec-label">
                            <Clock size={15} /> Approx. Time
                          </div>
                          <div className="item-spec-val">{item.found_time}</div>
                        </div>
                      )}

                      <div className="item-spec-row">
                        <div className="item-spec-label">
                          <ShieldCheck size={15} /> Reported On
                        </div>
                        <div className="item-spec-val">
                          {new Date(item.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="item-details-desc-title">Description & Details</div>
                    <div className="item-details-desc-text">{item.description}</div>

                    {/* Owner Controls */}
                    {isOwner ? (
                      <div className="item-details-owner-actions">
                        <button
                          type="button"
                          onClick={() => setEditModalOpen(true)}
                          className="btn-secondary"
                        >
                          <Edit size={15} /> Edit Report
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmOpen(true)}
                          className="btn-secondary"
                          style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                          <Trash2 size={15} /> Delete Report
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: 'auto',
                          padding: '14px 18px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '12px',
                          fontSize: '13.5px',
                          color: '#34d399',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <HeartHandshake size={18} />
                        <span>
                          Is this your lost item? Verify identifying details with campus security or check the Match Center.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <h2 className="modal-title">Edit Found Item Report</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditModalOpen(false)}
                disabled={updating}
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                {editError && (
                  <div className="report-server-error">
                    <AlertCircle size={16} />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Item Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="form-input"
                    disabled={updating}
                    required
                  />
                </div>

                <div className="form-row-2col">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="form-select"
                      disabled={updating}
                    >
                      {LOST_ITEM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="form-select"
                      disabled={updating}
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="MATCHED">MATCHED</option>
                      <option value="CLAIMED">CLAIMED</option>
                      <option value="RETURNED">RETURNED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Location Found</label>
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="form-select"
                    disabled={updating}
                  >
                    {CAMPUS_LOCATIONS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="form-textarea"
                    disabled={updating}
                    required
                  />
                </div>
              </div>

              <footer className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={updating}>
                  {updating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Delete Found Item Report</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                <X size={20} />
              </button>
            </header>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', margin: 0 }}>
                Are you sure you want to delete this found item report? This action cannot be undone.
              </p>
            </div>
            <footer className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#ef4444', color: '#fff' }}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  'Delete Report'
                )}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
