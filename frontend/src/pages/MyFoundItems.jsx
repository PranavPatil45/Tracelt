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
  HeartHandshake,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import { getMyFoundItems, updateFoundItem, deleteFoundItem } from '../api/foundItems.js'
import { LOST_ITEM_CATEGORIES, CAMPUS_LOCATIONS } from '../data/lostItemOptions.js'
import { getItemImageUrl } from '../utils/imageUrl.js'
import './MyFoundItems.css'

export default function MyFoundItems() {
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
  const [editStatus, setEditStatus] = useState('AVAILABLE')
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
      const data = await getMyFoundItems(token)
      setItems(data)
    } catch (err) {
      console.error('Error fetching my found items:', err)
      setError(err.message || 'Failed to load your found item reports.')
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
    setEditStatus(item.status || 'AVAILABLE')
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
      const updated = await updateFoundItem(
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

      setItems((prev) =>
        prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it))
      )
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
      await deleteFoundItem(deletingId, token)
      setItems((prev) => prev.filter((it) => it.id !== deletingId))
      setDeletingId(null)
    } catch (err) {
      alert(err.message || 'Failed to delete report.')
    } finally {
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
        <p>Loading your reports&hellip;</p>
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
          activeTabTitle="My Found Items"
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
          <div className="my-found-header">
            <div>
              <h1 className="my-found-title">My Found Items</h1>
              <p className="my-found-subtitle">
                Track and manage items you found and reported on campus.
              </p>
            </div>
            <Link to="/report-found" className="btn-primary">
              <PlusCircle size={16} /> Report Found Item
            </Link>
          </div>

          {error && (
            <div className="report-server-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loadingItems ? (
            <div className="my-found-loading">
              <Loader2 size={32} className="animate-spin" />
              <p>Fetching your found reports&hellip;</p>
            </div>
          ) : items.length === 0 ? (
            /* Empty State */
            <div className="found-empty-state">
              <div className="found-empty-icon">
                <HeartHandshake size={32} />
              </div>
              <h2 className="found-empty-title">No Found Items Yet</h2>
              <p className="found-empty-desc">
                Items you report as found will appear here. Thanks for helping make our campus community more helpful and connected!
              </p>
              <Link to="/report-found" className="btn-primary" style={{ marginTop: '8px' }}>
                <PlusCircle size={16} /> Report Found Item
              </Link>
            </div>
          ) : (
            /* Item Cards Grid */
            <div className="my-found-grid">
              {items.map((item) => (
                <article key={item.id} className="found-card">
                  <div className="found-card__media">
                    {getItemImageUrl(item.image_url) ? (
                      <img
                        src={getItemImageUrl(item.image_url)}
                        alt={item.title}
                        className="found-card__img"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          if (e.currentTarget.nextElementSibling) {
                            e.currentTarget.nextElementSibling.style.display = 'flex'
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className="found-card__placeholder"
                      style={{ display: getItemImageUrl(item.image_url) ? 'none' : 'flex' }}
                    >
                      <Package size={36} />
                      <span className="found-card__placeholder-cat">{item.category}</span>
                    </div>
                    <span className={`found-status-pill ${getStatusClass(item.status)}`}>
                      ● {item.status || 'AVAILABLE'}
                    </span>
                  </div>

                  <div className="found-card__body">
                    <span className="found-card__category">{item.category}</span>
                    <h3 className="found-card__title" title={item.title}>
                      {item.title}
                    </h3>

                    <div className="found-card__meta">
                      <div className="found-card__meta-item">
                        <MapPin size={14} />
                        <span>{item.location}</span>
                      </div>
                      <div className="found-card__meta-item">
                        <Calendar size={14} />
                        <span>Found: {item.found_date}</span>
                      </div>
                      {item.found_time && (
                        <div className="found-card__meta-item">
                          <Clock size={14} />
                          <span>Approx: {item.found_time}</span>
                        </div>
                      )}
                    </div>

                    <div className="found-card__actions">
                      <Link
                        to={`/found-items/${item.id}`}
                        className="found-action-btn found-action-btn--view"
                      >
                        <Eye size={14} /> View
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="found-action-btn found-action-btn--edit"
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        className="found-action-btn found-action-btn--delete"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <h2 className="modal-title">Edit Found Item Report</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingItem(null)}
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
                  onClick={() => setEditingItem(null)}
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
      {deletingId && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <header className="modal-header">
              <h2 className="modal-title">Delete Found Item Report</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeletingId(null)}
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
                onClick={() => setDeletingId(null)}
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
