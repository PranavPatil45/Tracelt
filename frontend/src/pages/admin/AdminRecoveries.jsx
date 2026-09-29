import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminRecoveries } from '../../api/admin.js'
import AdminTable from '../../components/admin/AdminTable.jsx'
import { RotateCcw, Eye, MapPin, Calendar, X, ArrowRight } from 'lucide-react'
import './AdminPages.css'

export default function AdminRecoveries() {
  const { token, user: currentAdmin } = useAuth()
  const [recoveries, setRecoveries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedRecovery, setSelectedRecovery] = useState(null)

  const loadRecoveries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminRecoveries(token, {
        status: statusFilter,
        campus: currentAdmin?.campus,
        page,
        limit: 15,
      })
      setRecoveries(res.recoveries || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load recoveries:', err)
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, page, currentAdmin?.campus])

  useEffect(() => {
    loadRecoveries()
  }, [loadRecoveries])

  const columns = [
    {
      key: 'item',
      label: 'Item Recovered',
      render: (r) => (
        <div>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
            {r.lost_item_title}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Recovery #{r.id} &bull; Claim #{r.claim_id}
          </span>
        </div>
      ),
    },
    {
      key: 'parties',
      label: 'Claimant & Finder',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--amber)' }}>{r.claimant_name}</span>
          <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--cyan)' }}>{r.finder_name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Recovery Status',
      render: (r) => {
        let badgeClass = 'admin-badge--pending'
        if (r.status === 'RECOVERED') badgeClass = 'admin-badge--active'
        if (r.status === 'RETURNED') badgeClass = 'admin-badge--claimed'
        if (r.status === 'CANCELLED') badgeClass = 'admin-badge--closed'
        return <span className={`admin-badge ${badgeClass}`}>{r.status}</span>
      },
    },
    {
      key: 'timeline',
      label: 'Timeline',
      render: (r) => (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {r.confirmed_at ? (
            <span>Confirmed: {new Date(r.confirmed_at).toLocaleDateString()}</span>
          ) : r.returned_at ? (
            <span>Handed over: {new Date(r.returned_at).toLocaleDateString()}</span>
          ) : (
            <span>Coordination pending</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <button
          onClick={() => setSelectedRecovery(r)}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '0.35rem 0.65rem' }}
          title="Inspect handover logistics and status"
        >
          <Eye size={14} /> Details
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Recovery &amp; Return Monitoring</h2>
          <p>Track return coordination, verified owner handovers, and final resolution states.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-filter-group">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="admin-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="RETURN_PENDING">Return Pending</option>
            <option value="RETURNED">Handed Over (Awaiting Confirmation)</option>
            <option value="RECOVERED">Confirmed Recovered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <AdminTable
        columns={columns}
        data={recoveries}
        loading={loading}
        page={page}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No recovery records found matching current filter."
      />

      {/* Recovery Detail Modal */}
      {selectedRecovery && (
        <div className="admin-modal-overlay" onClick={() => setSelectedRecovery(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} style={{ color: 'var(--cyan)' }} />
                Recovery Record #{selectedRecovery.id}
              </h3>
              <button
                onClick={() => setSelectedRecovery(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Lost Item (Owner)
                  </span>
                  <strong>{selectedRecovery.lost_item_title}</strong>
                  <span style={{ display: 'block', color: 'var(--amber)', fontSize: '0.82rem' }}>
                    {selectedRecovery.claimant_name}
                  </span>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Found Item (Finder)
                  </span>
                  <strong>{selectedRecovery.found_item_title}</strong>
                  <span style={{ display: 'block', color: 'var(--cyan)', fontSize: '0.82rem' }}>
                    {selectedRecovery.finder_name}
                  </span>
                </div>
              </div>

              <div style={{ background: 'var(--bg-elevated-2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                  Return Coordination Logistics
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.88rem' }}>
                  <MapPin size={16} style={{ color: 'var(--cyan)' }} />
                  <span>Location: <strong>{selectedRecovery.return_location || 'Not specified (Direct Handover)'}</strong></span>
                </div>
                {selectedRecovery.return_notes && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    &ldquo;{selectedRecovery.return_notes}&rdquo;
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status Timeline:</span>
                <div>
                  <strong>Created:</strong> {new Date(selectedRecovery.created_at).toLocaleString()}
                </div>
                {selectedRecovery.returned_at && (
                  <div>
                    <strong>Handed over:</strong> {new Date(selectedRecovery.returned_at).toLocaleString()}
                  </div>
                )}
                {selectedRecovery.confirmed_at && (
                  <div style={{ color: '#22c55e' }}>
                    <strong>Confirmed Recovered:</strong> {new Date(selectedRecovery.confirmed_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <Link to={`/recovery/${selectedRecovery.id}`} className="admin-btn admin-btn-primary">
                Open Full Recovery Workspace &rarr;
              </Link>
              <button onClick={() => setSelectedRecovery(null)} className="admin-btn admin-btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
