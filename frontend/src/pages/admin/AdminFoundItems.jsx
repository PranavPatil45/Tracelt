import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminFoundItems, updateAdminItemStatus } from '../../api/admin.js'
import { getItemImageUrl } from '../../utils/imageUrl.js'
import AdminTable from '../../components/admin/AdminTable.jsx'
import { Search, Eye, ShieldAlert, X, Loader2, Package } from 'lucide-react'
import './AdminPages.css'

export default function AdminFoundItems() {
  const { token, user: currentAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Moderation modal
  const [moderatingItem, setModeratingItem] = useState(null)
  const [targetStatus, setTargetStatus] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [modError, setModError] = useState('')

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminFoundItems(token, {
        search,
        category: categoryFilter,
        status: statusFilter,
        campus: currentAdmin?.campus,
        page,
        limit: 15,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load found items:', err)
    } finally {
      setLoading(false)
    }
  }, [token, search, categoryFilter, statusFilter, page, currentAdmin?.campus])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  function handleOpenModerate(item) {
    setModeratingItem(item)
    setTargetStatus(item.status)
    setReason('')
    setModError('')
  }

  async function handleSaveStatus(e) {
    e.preventDefault()
    if (!moderatingItem) return
    setSaving(true)
    setModError('')

    try {
      await updateAdminItemStatus(token, 'found', moderatingItem.id, {
        status: targetStatus,
        reason,
      })
      setModeratingItem(null)
      loadItems()
    } catch (err) {
      setModError(err.message || 'Failed to update found item status.')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'item',
      label: 'Found Item',
      render: (item) => {
        const imgUrl = getItemImageUrl(item.image_url)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated-2)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {imgUrl ? (
                <img src={imgUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Package size={18} style={{ color: 'var(--text-muted)' }} />
              )}
            </div>
            <div>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>{item.title}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID #{item.id} &bull; {item.category}</span>
            </div>
          </div>
        )
      }
    },
    {
      key: 'finder',
      label: 'Found By',
      render: (item) => (
        <div>
          <span style={{ display: 'block', fontSize: '0.85rem' }}>{item.user_name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.user_email}</span>
        </div>
      )
    },
    {
      key: 'location',
      label: 'Location & Date',
      render: (item) => (
        <div>
          <span style={{ display: 'block', fontSize: '0.85rem' }}>{item.location}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.found_date}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => {
        let badgeClass = 'admin-badge--available'
        if (item.status === 'CLAIMED') badgeClass = 'admin-badge--claimed'
        else if (item.status === 'RECOVERED') badgeClass = 'admin-badge--recovered'
        else if (item.status === 'CLOSED') badgeClass = 'admin-badge--closed'
        else if (item.status === 'HIDDEN' || item.status === 'REMOVED') badgeClass = 'admin-badge--hidden'
        return <span className={`admin-badge ${badgeClass}`}>{item.status}</span>
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            to={`/found-items/${item.id}`}
            className="admin-btn admin-btn-secondary"
            style={{ padding: '0.35rem 0.65rem' }}
            title="Inspect item report page"
          >
            <Eye size={14} /> View
          </Link>
          <button
            onClick={() => handleOpenModerate(item)}
            className="admin-btn admin-btn-secondary"
            style={{ padding: '0.35rem 0.65rem' }}
            title="Moderate status"
          >
            <ShieldAlert size={14} /> Moderate
          </button>
        </div>
      )
    }
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Found Items Moderation</h2>
          <p>Inspect and moderate found item reports across {currentAdmin?.campus || 'campus'}.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search-box">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by title, location, description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="admin-search-input"
          />
        </div>

        <div className="admin-filter-group">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
            className="admin-select"
          >
            <option value="ALL">All Categories</option>
            <option value="Wallets & Purses">Wallets &amp; Purses</option>
            <option value="Electronics">Electronics</option>
            <option value="Bags & Backpacks">Bags &amp; Backpacks</option>
            <option value="Identity Cards">Identity Cards</option>
            <option value="Keys">Keys</option>
            <option value="Clothing & Accessories">Clothing</option>
            <option value="Books & Stationery">Books</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="admin-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="CLAIMED">Claimed</option>
            <option value="RECOVERED">Recovered</option>
            <option value="CLOSED">Closed</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={items}
        loading={loading}
        page={page}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No found items found matching your filters."
      />

      {/* Moderation Modal */}
      {moderatingItem && (
        <div className="admin-modal-overlay" onClick={() => setModeratingItem(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveStatus}>
              <div className="admin-modal-header">
                <h3>Moderate Found Item: #{moderatingItem.id}</h3>
                <button
                  type="button"
                  onClick={() => setModeratingItem(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Modifying state for <strong>{moderatingItem.title}</strong> reported by {moderatingItem.user_name}.
                </p>

                {modError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem'
                  }}>
                    {modError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Moderation Status</label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    className="admin-select"
                  >
                    <option value="AVAILABLE">AVAILABLE (Visible in public directory)</option>
                    <option value="CLAIMED">CLAIMED</option>
                    <option value="RECOVERED">RECOVERED (Handed over)</option>
                    <option value="CLOSED">CLOSED (Archived)</option>
                    <option value="HIDDEN">HIDDEN (Hidden from directory)</option>
                    <option value="REMOVED">REMOVED (Inappropriate report)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Administrative Reason / Note</label>
                  <textarea
                    rows={3}
                    placeholder="Provide reason for status change (stored in audit trail)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{
                      background: 'var(--bg-elevated-2)',
                      border: '1px solid var(--border-hair)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      padding: '0.65rem',
                      fontSize: '0.85rem',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setModeratingItem(null)}
                  className="admin-btn admin-btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Apply Moderation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
