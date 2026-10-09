import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertCircle,
  Share2,
  Check,
  GitCompare,
  Layers,
  HeartHandshake,
  Loader2,
  X,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import ItemImage from '../components/item/ItemImage.jsx'
import ItemMetadata from '../components/item/ItemMetadata.jsx'
import ItemDescription from '../components/item/ItemDescription.jsx'
import ReportInformation from '../components/item/ReportInformation.jsx'
import ClaimActionModal from '../components/item/ClaimActionModal.jsx'
import DeleteItemDialog from '../components/item/DeleteItemDialog.jsx'
import ItemDetailsSkeleton from '../components/item/ItemDetailsSkeleton.jsx'
import { getItemDetails, updateItemDetails, deleteItemDetails } from '../api/items.js'
import { getLostItemMatches, getFoundItemMatches } from '../api/matches.js'
import { LOST_ITEM_CATEGORIES, CAMPUS_LOCATIONS } from '../data/lostItemOptions.js'
import './ItemDetailsPage.css'

export default function ItemDetailsPage({ initialType }) {
  const { id, type: routeType } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, loading: authLoading, logout, isAuthenticated } = useAuth()

  // Determine effective item type ('LOST' or 'FOUND')
  const determineType = () => {
    if (routeType) return routeType.toUpperCase()
    if (initialType) return initialType.toUpperCase()
    if (location.pathname.includes('/lost-items')) return 'LOST'
    if (location.pathname.includes('/found-items')) return 'FOUND'
    return 'LOST'
  }

  const effectiveType = determineType()

  // UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [item, setItem] = useState(null)
  const [loadingItem, setLoadingItem] = useState(true)
  const [error, setError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState('ACTIVE')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Claim Modal State
  const [claimModalOpen, setClaimModalOpen] = useState(false)

  // Route protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const [itemMatches, setItemMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  // Load item details
  const loadItem = useCallback(async () => {
    if (!id) return
    setLoadingItem(true)
    setError('')
    try {
      const data = await getItemDetails(effectiveType, id, token)
      setItem(data)
      setEditTitle(data.title || '')
      setEditCategory(data.category || '')
      setEditLocation(data.location || '')
      setEditDescription(data.description || '')
      setEditStatus(data.status || (data.type === 'FOUND' ? 'AVAILABLE' : 'ACTIVE'))
    } catch (err) {
      setError(err.message || 'Could not retrieve item details.')
    } finally {
      setLoadingItem(false)
    }
  }, [id, effectiveType, token])

  // Load candidate matches for this item
  const loadItemMatches = useCallback(async () => {
    if (!id || !effectiveType || !token) return
    setLoadingMatches(true)
    try {
      if (effectiveType === 'LOST') {
        const res = await getLostItemMatches(id, token)
        setItemMatches(res)
      } else {
        const res = await getFoundItemMatches(id, token)
        setItemMatches(res)
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingMatches(false)
    }
  }, [id, effectiveType, token])

  useEffect(() => {
    if (isAuthenticated && id) {
      loadItem()
      loadItemMatches()
    }
  }, [isAuthenticated, id, loadItem, loadItemMatches])

  // Owner verification check
  const isOwner = Boolean(user?.id && item?.user_id && user.id === item.user_id)

  // Share handler
  function handleShare() {
    navigator.clipboard?.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // Handle Edit Submit
  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editTitle.trim() || !editDescription.trim()) {
      setEditError('Title and description cannot be empty.')
      return
    }

    setSavingEdit(true)
    setEditError('')
    try {
      const payload = {
        title: editTitle.trim(),
        category: editCategory,
        location: editLocation.trim(),
        description: editDescription.trim(),
        status: editStatus,
      }
      const updated = await updateItemDetails(item.type, id, payload, token)
      setItem((prev) => ({
        ...prev,
        ...updated,
        title: updated.title || payload.title,
        category: updated.category || payload.category,
        location: updated.location || payload.location,
        description: updated.description || payload.description,
        status: updated.status || payload.status,
      }))
      setEditModalOpen(false)
    } catch (err) {
      setEditError(err.message || 'Failed to update report.')
    } finally {
      setSavingEdit(false)
    }
  }

  // Handle Delete Confirmation
  async function handleDeleteConfirm() {
    setDeleting(true)
    try {
      await deleteItemDetails(item.type, id, token)
      const redirectPath = item.type === 'LOST' ? '/my-lost-items' : '/my-found-items'
      navigate(redirectPath)
    } catch (err) {
      alert(err.message || 'Failed to delete report.')
      setDeleting(false)
    }
  }

  // Smart back navigation
  function handleBack() {
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      navigate('/explore')
    }
  }

  if (authLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Authenticating session&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  const isLost = item?.type === 'LOST'

  return (
    <div className="dashboard-app">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={effectiveType === 'FOUND' ? 'found-items' : 'lost-items'}
        setActiveTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle={item ? item.title : 'Item Details'}
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content item-detail-page-content">
          <div className="item-detail-max-wrapper">
            {/* Top Navigation Bar: Breadcrumbs & Back */}
            <div className="item-detail-nav-bar">
              <button
                type="button"
                className="item-back-btn"
                onClick={handleBack}
                aria-label="Go back to previous page"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <nav className="item-breadcrumbs" aria-label="Breadcrumb">
                <Link to="/explore" className="item-breadcrumb-link">
                  Explore
                </Link>
                <ChevronRight size={14} className="item-breadcrumb-sep" />
                <span className="item-breadcrumb-curr">
                  {effectiveType === 'LOST' ? 'Lost Items' : 'Found Items'}
                </span>
                {item && (
                  <>
                    <ChevronRight size={14} className="item-breadcrumb-sep" />
                    <span className="item-breadcrumb-curr">{item.category}</span>
                    <ChevronRight size={14} className="item-breadcrumb-sep" />
                    <span className="item-breadcrumb-title" title={item.title}>
                      {item.title}
                    </span>
                  </>
                )}
              </nav>
            </div>

            {/* Content States */}
            {loadingItem ? (
              <ItemDetailsSkeleton />
            ) : error ? (
              <div className="item-error-card" role="alert">
                <div className="item-error-icon">
                  <AlertCircle size={36} />
                </div>
                <h2 className="item-error-title">Report Unavailable</h2>
                <p className="item-error-msg">{error}</p>
                <div className="item-error-actions">
                  <button type="button" onClick={loadItem} className="btn btn-secondary">
                    Retry Loading
                  </button>
                  <Link to="/explore" className="btn btn-primary">
                    Browse Explore Catalog
                  </Link>
                </div>
              </div>
            ) : item ? (
              <div className="item-detail-layout">
                {/* Left Column: Visuals & Report Info */}
                <div className="item-detail-left-col">
                  {/* Photo Display */}
                  <ItemImage
                    imageUrl={item.image_url}
                    title={item.title}
                    category={item.category}
                  />

                  {/* Report Information Section */}
                  <ReportInformation item={item} />

                  {/* Possible Matches Section */}
                  <section className="item-match-engine-card" aria-labelledby="match-engine-title">
                    <div className="item-match-engine-header">
                      <div className="item-match-engine-title-wrap">
                        <GitCompare size={16} className="item-match-engine-icon" />
                        <h3 id="match-engine-title" className="item-match-engine-title">
                          Possible Matches {itemMatches.length > 0 ? `(${itemMatches.length})` : ''}
                        </h3>
                      </div>
                      <span className="item-match-engine-badge">
                        {itemMatches.length > 0 ? 'MATCH DETECTED' : 'CORRELATION ACTIVE'}
                      </span>
                    </div>

                    {loadingMatches ? (
                      <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Scanning for complementary reports...
                      </div>
                    ) : itemMatches.length > 0 ? (
                      <div className="item-matches-list">
                        {itemMatches.map((m) => {
                          const otherItem = effectiveType === 'LOST' ? m.found_item : m.lost_item
                          const otherUrl = effectiveType === 'LOST' ? `/found-items/${otherItem?.id}` : `/lost-items/${otherItem?.id}`

                          return (
                            <div key={m.id} className="item-match-preview-card">
                              <div className="item-match-preview-header">
                                <h4 className="item-match-preview-title">{otherItem?.title}</h4>
                                <span className="item-match-preview-score">{m.score}% Match</span>
                              </div>

                              <div className="item-match-preview-meta">
                                <span>{effectiveType === 'LOST' ? 'Found' : 'Lost'} &bull; {otherItem?.location}</span>
                              </div>

                              {m.reasons && m.reasons.length > 0 && (
                                <ul className="item-match-preview-reasons">
                                  {m.reasons.slice(0, 3).map((r, i) => (
                                    <li key={i}>✓ {r}</li>
                                  ))}
                                </ul>
                              )}

                              <Link to={otherUrl} className="item-match-preview-link">
                                <span>View {effectiveType === 'LOST' ? 'Found' : 'Lost'} Report</span>
                                <ChevronRight size={13} />
                              </Link>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <>
                        <p className="item-match-engine-desc">
                          Tracelt&rsquo;s automated match analyzer continuously checks campus reports across categories, locations, and timeframes to connect lost items with finders.
                        </p>
                        <div className="item-match-engine-footer">
                          <Layers size={14} />
                          <span>No matching reports found yet on campus.</span>
                        </div>
                      </>
                    )}
                  </section>
                </div>

                {/* Right Column: Metadata, Description & Action Controls */}
                <div className="item-detail-right-col">
                  {/* Primary Metadata & Specs */}
                  <ItemMetadata item={item} isOwner={isOwner} />

                  {/* Description Section */}
                  <ItemDescription description={item.description} />

                  {/* Actions Bar */}
                  <div className="item-actions-panel">
                    {isOwner ? (
                      /* Owner Actions */
                      <div className="item-owner-action-group">
                        <button
                          type="button"
                          className="btn btn-secondary item-action-btn"
                          onClick={() => setEditModalOpen(true)}
                        >
                          <Edit size={16} />
                          <span>Edit Report</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-outline item-action-btn"
                          onClick={() => setDeleteDialogOpen(true)}
                        >
                          <Trash2 size={16} />
                          <span>Delete Report</span>
                        </button>
                      </div>
                    ) : (
                      /* Non-Owner Claim Action */
                      <div className="item-claim-action-group">
                        <button
                          type="button"
                          className="btn btn-primary item-claim-btn"
                          onClick={() => setClaimModalOpen(true)}
                        >
                          <HeartHandshake size={18} />
                          <span>
                            {isLost ? 'This Might Be Mine' : 'This Might Be My Item'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Share / Copy Link Button */}
                    <button
                      type="button"
                      className="btn btn-ghost item-share-btn"
                      onClick={handleShare}
                      title="Share link to this report"
                      aria-label="Share link"
                    >
                      {copiedLink ? (
                        <>
                          <Check size={16} style={{ color: '#34d399' }} />
                          <span style={{ color: '#34d399' }}>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Share2 size={16} />
                          <span>Share Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div
          className="item-modal-backdrop"
          onClick={() => setEditModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-report-title"
        >
          <div className="item-modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="item-modal-header">
              <h2 id="edit-report-title" className="item-modal-title">
                Edit {item.type === 'LOST' ? 'Lost Item' : 'Found Item'} Report
              </h2>
              <button
                type="button"
                className="item-modal-close"
                onClick={() => setEditModalOpen(false)}
                disabled={savingEdit}
                aria-label="Close edit dialog"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveEdit} className="item-modal-body">
              {editError && (
                <div className="item-modal-error">
                  <AlertCircle size={15} />
                  <span>{editError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="edit-title">
                  Item Title *
                </label>
                <input
                  id="edit-title"
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={savingEdit}
                  required
                />
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-category">
                    Category *
                  </label>
                  <select
                    id="edit-category"
                    className="form-select"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={savingEdit}
                  >
                    {LOST_ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-status">
                    Report Status *
                  </label>
                  <select
                    id="edit-status"
                    className="form-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    disabled={savingEdit}
                  >
                    {item.type === 'LOST' ? (
                      <>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="MATCHED">MATCHED</option>
                        <option value="CLAIMED">CLAIMED</option>
                        <option value="RECOVERED">RECOVERED</option>
                        <option value="CLOSED">CLOSED</option>
                      </>
                    ) : (
                      <>
                        <option value="AVAILABLE">AVAILABLE</option>
                        <option value="MATCHED">MATCHED</option>
                        <option value="CLAIMED">CLAIMED</option>
                        <option value="RETURNED">RETURNED</option>
                        <option value="CLOSED">CLOSED</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-location">
                  {item.type === 'LOST' ? 'Last Seen Location *' : 'Found Location *'}
                </label>
                <input
                  id="edit-location"
                  type="text"
                  className="form-input"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  disabled={savingEdit}
                  required
                  list="campus-locations-list"
                />
                <datalist id="campus-locations-list">
                  {CAMPUS_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-description">
                  Description &amp; Identifying Marks *
                </label>
                <textarea
                  id="edit-description"
                  rows={4}
                  className="form-textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={savingEdit}
                  required
                />
              </div>

              <footer className="item-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving Changes...
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

      {/* Delete Confirmation Dialog */}
      <DeleteItemDialog
        isOpen={deleteDialogOpen}
        itemTitle={item?.title || ''}
        itemType={item?.type || 'LOST'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
        isDeleting={deleting}
      />

      {/* Claim & Verification Modal */}
      {item && (
        <ClaimActionModal
          item={item}
          isOpen={claimModalOpen}
          onClose={() => setClaimModalOpen(false)}
        />
      )}
    </div>
  )
}
