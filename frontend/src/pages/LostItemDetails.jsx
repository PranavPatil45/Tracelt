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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import { getLostItemById, updateLostItem, deleteLostItem } from '../api/lostItems.js'
import { LOST_ITEM_CATEGORIES } from '../data/lostItemOptions.js'
import { getItemImageUrl } from '../utils/imageUrl.js'
import './LostItemDetails.css'

export default function LostItemDetails() {
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
  const [editStatus, setEditStatus] = useState('ACTIVE')
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
      const data = await getLostItemById(id, token)
      setItem(data)
      setEditTitle(data.title)
      setEditCategory(data.category)
      setEditDescription(data.description)
      setEditLocation(data.location)
      setEditStatus(data.status || 'ACTIVE')
    } catch (err) {
      setError(err.message || 'Lost item not found.')
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
      const updated = await updateLostItem(
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

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteLostItem(id, token)
      navigate('/my-lost-items')
    } catch (err) {
      alert(err.message || 'Failed to delete report.')
      setDeleting(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading Tracelt&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="dashboard-app">
      <Sidebar
        activeTab="lost-items"
        setActiveTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Item Details"
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content">
          <div className="item-details-container">
            <div className="item-details-back">
              <Link to="/my-lost-items" className="report-back-link">
                <ArrowLeft size={16} />
                <span>Back to My Lost Items</span>
              </Link>
            </div>

            {loadingItem ? (
              <div className="my-lost-loading">
                <div className="dashboard-loading__spinner" />
                <p>Loading item details&hellip;</p>
              </div>
            ) : error ? (
              <div className="empty-state-card">
                <div className="empty-state-card__icon">⚠️</div>
                <h3 className="empty-state-card__title">Item Not Found</h3>
                <p className="empty-state-card__desc">{error}</p>
                <Link to="/my-lost-items" className="btn btn-primary">
                  View My Lost Items
                </Link>
              </div>
            ) : item ? (
              <div className="item-details-card">
                <div className="item-details-grid">
                  {/* Media Section */}
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
                        <Package size={56} strokeWidth={1.4} />
                        <span>{imgError ? 'Image could not be loaded' : 'No photo attached'}</span>
                      </div>
                    )}
                  </div>

                  {/* Info Section */}
                  <div className="item-details-info">
                    <div className="item-details-top">
                      <span className="item-details-category">{item.category}</span>
                      <span className={`lost-status-pill lost-status-pill--${item.status.toLowerCase()}`}>
                        <span className="status-dot" />
                        {item.status}
                      </span>
                    </div>

                    <h1 className="item-details-title">{item.title}</h1>

                    <div className="item-details-specs">
                      <div className="spec-row">
                        <MapPin size={16} className="spec-icon" />
                        <div>
                          <span className="spec-label">Last Seen Location</span>
                          <span className="spec-val">{item.location}</span>
                        </div>
                      </div>

                      <div className="spec-row">
                        <Calendar size={16} className="spec-icon" />
                        <div>
                          <span className="spec-label">Date Lost</span>
                          <span className="spec-val">{formatDate(item.lost_date)}</span>
                        </div>
                      </div>

                      {item.lost_time && (
                        <div className="spec-row">
                          <Clock size={16} className="spec-icon" />
                          <div>
                            <span className="spec-label">Approximate Time</span>
                            <span className="spec-val">{item.lost_time}</span>
                          </div>
                        </div>
                      )}

                      {item.campus && (
                        <div className="spec-row">
                          <ShieldCheck size={16} className="spec-icon" />
                          <div>
                            <span className="spec-label">Campus Scope</span>
                            <span className="spec-val">{item.campus}</span>
                          </div>
                        </div>
                      )}

                      <div className="spec-row">
                        <Clock size={16} className="spec-icon" />
                        <div>
                          <span className="spec-label">Reported On</span>
                          <span className="spec-val">{formatDate(item.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="item-details-desc-box">
                      <span className="desc-box-label">Description &amp; Identifying Marks</span>
                      <p className="desc-box-text">{item.description}</p>
                    </div>

                    {/* Owner Action Buttons */}
                    {isOwner && (
                      <div className="item-owner-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEditModalOpen(true)}
                        >
                          <Edit size={15} />
                          <span>Edit Report</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => setDeleteConfirmOpen(true)}
                        >
                          <Trash2 size={15} />
                          <span>Delete Report</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="edit-modal-backdrop" onClick={() => setEditModalOpen(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal__header">
              <h2 className="edit-modal__title">Edit Report</h2>
              <button
                type="button"
                className="edit-modal__close"
                onClick={() => setEditModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div className="report-server-error" style={{ marginBottom: '14px' }}>
                <AlertCircle size={15} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="edit-modal__form">
              <div className="form-group">
                <label className="form-label">Item Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
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
                    className="form-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MATCHED">MATCHED</option>
                    <option value="CLAIMED">CLAIMED</option>
                    <option value="RECOVERED">RECOVERED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div className="edit-modal__actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="edit-modal-backdrop" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal__icon">
              <Trash2 size={28} />
            </div>
            <h3 className="delete-modal__title">Delete this report?</h3>
            <p className="delete-modal__desc">
              Are you sure you want to delete this lost item report? This action is permanent and cannot be undone.
            </p>
            <div className="delete-modal__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
