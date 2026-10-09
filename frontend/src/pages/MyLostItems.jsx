import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search,
  PlusCircle,
  MapPin,
  Calendar,
  Clock,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Package,
  PackageSearch,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import { getMyLostItems, updateLostItem, deleteLostItem } from '../api/lostItems.js'
import { LOST_ITEM_CATEGORIES, CAMPUS_LOCATIONS } from '../data/lostItemOptions.js'
import { getItemImageUrl } from '../utils/imageUrl.js'
import './MyLostItems.css'

export default function MyLostItems() {
  const { user, token, loading, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [error, setError] = useState('')

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStatus, setEditStatus] = useState('ACTIVE')
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [loading, isAuthenticated, navigate])

  const loadItems = useCallback(async () => {
    if (!token) return
    setLoadingItems(true)
    setError('')
    try {
      const data = await getMyLostItems(token)
      setItems(data)
    } catch (err) {
      console.error('Error fetching my lost items:', err)
      setError(err.message || 'Failed to load your lost item reports.')
    } finally {
      setLoadingItems(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) {
      loadItems()
    }
  }, [isAuthenticated, loadItems])

  function handleOpenEdit(item) {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditCategory(item.category)
    setEditDescription(item.description)
    setEditLocation(item.location)
    setEditStatus(item.status || 'ACTIVE')
    setEditError('')
  }

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
        editingItem.id,
        {
          title: editTitle.trim(),
          category: editCategory,
          description: editDescription.trim(),
          location: editLocation,
          status: editStatus,
        },
        token
      )

      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      setEditingItem(null)
    } catch (err) {
      setEditError(err.message || 'Failed to update report.')
    } finally {
      setUpdating(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingId) return
    setDeleting(true)
    try {
      await deleteLostItem(deletingId, token)
      setItems((prev) => prev.filter((i) => i.id !== deletingId))
      setDeletingId(null)
    } catch (err) {
      alert(err.message || 'Failed to delete report.')
    } finally {
      setDeleting(false)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
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
          activeTabTitle="My Lost Items"
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content">
          <div className="my-lost-header">
            <div>
              <h1 className="my-lost-title">My Lost Items</h1>
              <p className="my-lost-subtitle">
                Manage your active lost-item reports and track campus matching status.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/report-lost')}
            >
              <PlusCircle size={16} />
              <span>+ Report Lost Item</span>
            </button>
          </div>

          {error && (
            <div className="report-server-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loadingItems ? (
            <div className="my-lost-loading">
              <div className="dashboard-loading__spinner" />
              <p>Fetching your campus reports&hellip;</p>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-state-card__icon-box">
                <PackageSearch size={28} />
              </div>
              <h3 className="empty-state-card__title">No Lost Items Reported</h3>
              <p className="empty-state-card__desc">
                You haven&rsquo;t reported anything lost yet. If you misplace an item on campus, report it to begin automated trace matching.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/report-lost')}
              >
                Report Lost Item
              </button>
            </div>
          ) : (
            <div className="my-lost-grid">
              {items.map((item) => (
                <div key={item.id} className="lost-card">
                  {/* Card Image or Placeholder */}
                  <div className="lost-card__media">
                    {getItemImageUrl(item.image_url) ? (
                      <img
                        src={getItemImageUrl(item.image_url)}
                        alt={item.title}
                        className="lost-card__img"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          if (e.currentTarget.nextElementSibling) {
                            e.currentTarget.nextElementSibling.style.display = 'flex'
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className="lost-card__placeholder"
                      style={{ display: getItemImageUrl(item.image_url) ? 'none' : 'flex' }}
                    >
                      <Package size={36} strokeWidth={1.5} />
                      <span className="lost-card__placeholder-cat">{item.category}</span>
                    </div>
                    <span className={`lost-status-pill lost-status-pill--${item.status.toLowerCase()}`}>
                      <span className="status-dot" />
                      {item.status}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="lost-card__body">
                    <span className="lost-card__category">{item.category}</span>
                    <h3 className="lost-card__title">{item.title}</h3>

                    <div className="lost-card__meta">
                      <div className="lost-meta-item">
                        <MapPin size={13} className="meta-icon" />
                        <span>{item.location}</span>
                      </div>

                      <div className="lost-meta-item">
                        <Calendar size={13} className="meta-icon" />
                        <span>Lost: {formatDate(item.lost_date)}</span>
                      </div>

                      {item.lost_time && (
                        <div className="lost-meta-item">
                          <Clock size={13} className="meta-icon" />
                          <span>Time: {item.lost_time}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="lost-card__actions">
                    <Link
                      to={`/lost-items/${item.id}`}
                      className="btn-card-action btn-card-action--view"
                      title="View Details"
                    >
                      <Eye size={14} />
                      <span>View</span>
                    </Link>

                    <button
                      type="button"
                      className="btn-card-action btn-card-action--edit"
                      onClick={() => handleOpenEdit(item)}
                      title="Edit Report"
                    >
                      <Edit size={14} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      className="btn-card-action btn-card-action--delete"
                      onClick={() => setDeletingId(item.id)}
                      title="Delete Report"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="edit-modal-backdrop" onClick={() => setEditingItem(null)}>
          <div
            className="edit-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
          >
            <div className="edit-modal__header">
              <h2 id="edit-modal-title" className="edit-modal__title">
                Edit Lost Item Report
              </h2>
              <button
                type="button"
                className="edit-modal__close"
                onClick={() => setEditingItem(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div className="report-server-error" style={{ marginBottom: '16px' }}>
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
                    {LOST_ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
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
                  onClick={() => setEditingItem(null)}
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
      {deletingId && (
        <div className="edit-modal-backdrop" onClick={() => setDeletingId(null)}>
          <div
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="delete-modal__icon">
              <Trash2 size={28} />
            </div>
            <h3 className="delete-modal__title">Delete this report?</h3>
            <p className="delete-modal__desc">
              Are you sure you want to delete this lost item report? This action cannot be undone.
            </p>
            <div className="delete-modal__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingId(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
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
