import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminClaims, reviewAdminClaim } from '../../api/admin.js'
import AdminTable from '../../components/admin/AdminTable.jsx'
import { FileCheck2, Eye, CheckCircle2, XCircle, X, Loader2, AlertCircle } from 'lucide-react'
import './AdminPages.css'

export default function AdminClaims() {
  const { token, user: currentAdmin } = useAuth()
  const [claims, setClaims] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Claim Review Modal
  const [inspectClaim, setInspectClaim] = useState(null)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [actionError, setActionError] = useState('')

  const loadClaims = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminClaims(token, {
        status: statusFilter,
        campus: currentAdmin?.campus,
        page,
        limit: 15,
      })
      setClaims(res.claims || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load claims:', err)
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, page, currentAdmin?.campus])

  useEffect(() => {
    loadClaims()
  }, [loadClaims])

  function handleOpenInspect(claim) {
    setInspectClaim(claim)
    setReviewerNotes(claim.reviewer_notes || '')
    setActionError('')
  }

  async function handleExecuteReview(action) {
    if (!inspectClaim) return
    setProcessing(true)
    setActionError('')

    try {
      await reviewAdminClaim(token, inspectClaim.id, {
        action,
        reviewer_notes: reviewerNotes,
      })
      setInspectClaim(null)
      loadClaims()
    } catch (err) {
      setActionError(err.message || `Failed to ${action.toLowerCase()} claim.`)
    } finally {
      setProcessing(false)
    }
  }

  const columns = [
    {
      key: 'claimant',
      label: 'Claimant',
      render: (c) => (
        <div>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>{c.claimant_name}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.claimant_email}</span>
        </div>
      ),
    },
    {
      key: 'items',
      label: 'Claimed Items',
      render: (c) => (
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--amber)', display: 'block' }}>
            Lost: {c.lost_item_title}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--cyan)', display: 'block' }}>
            Found: {c.found_item_title} (Finder: {c.finder_name || 'N/A'})
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (c) => {
        let badgeClass = 'admin-badge--pending'
        if (c.status === 'APPROVED') badgeClass = 'admin-badge--active'
        if (c.status === 'REJECTED') badgeClass = 'admin-badge--closed'
        if (c.status === 'CANCELLED') badgeClass = 'admin-badge--hidden'
        return <span className={`admin-badge ${badgeClass}`}>{c.status}</span>
      },
    },
    {
      key: 'created_at',
      label: 'Submitted At',
      render: (c) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {new Date(c.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (c) => (
        <button
          onClick={() => handleOpenInspect(c)}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '0.35rem 0.65rem' }}
          title="Inspect claim verification evidence"
        >
          <Eye size={14} /> Review Claim
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Claims &amp; Verification Management</h2>
          <p>Inspect submitted ownership evidence and intervene in pending claims.</p>
        </div>
      </div>

      {/* Toolbar */}
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
            <option value="PENDING">Pending Review</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <AdminTable
        columns={columns}
        data={claims}
        loading={loading}
        page={page}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No claims found matching current criteria."
      />

      {/* Review Modal */}
      {inspectClaim && (
        <div className="admin-modal-overlay" onClick={() => setInspectClaim(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileCheck2 size={18} style={{ color: 'var(--cyan)' }} />
                Review Claim #{inspectClaim.id} ({inspectClaim.status})
              </h3>
              <button
                onClick={() => setInspectClaim(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              {actionError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Items & Participants */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Claimant (Owner)
                  </span>
                  <strong>{inspectClaim.claimant_name}</strong>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {inspectClaim.claimant_email}
                  </span>
                  <div style={{ marginTop: '0.4rem' }}>
                    <Link to={`/lost-items/${inspectClaim.lost_item_id}`} style={{ color: 'var(--amber)', fontSize: '0.82rem' }}>
                      Lost Item: {inspectClaim.lost_item_title} &rarr;
                    </Link>
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Finder
                  </span>
                  <strong>{inspectClaim.finder_name || 'Anonymous Finder'}</strong>
                  <div style={{ marginTop: '0.4rem' }}>
                    <Link to={`/found-items/${inspectClaim.found_item_id}`} style={{ color: 'var(--cyan)', fontSize: '0.82rem' }}>
                      Found Item: {inspectClaim.found_item_title} &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Verification Details */}
              <div style={{ background: 'var(--bg-elevated-2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--cyan)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Submitted Verification Details &amp; Evidence
                </span>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {inspectClaim.verification_details}
                </p>
                {inspectClaim.additional_message && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-hair)', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Additional Note to Finder:
                    </span>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {inspectClaim.additional_message}
                    </p>
                  </div>
                )}
              </div>

              {/* Reviewer notes / history */}
              {inspectClaim.status === 'APPROVED' || inspectClaim.status === 'REJECTED' ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Reviewed by <strong>{inspectClaim.reviewed_by_name || 'Finder/Admin'}</strong> on {inspectClaim.reviewed_at ? new Date(inspectClaim.reviewed_at).toLocaleDateString() : 'N/A'}.</span>
                  {inspectClaim.reviewer_notes && (
                    <p style={{ marginTop: '0.3rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      &ldquo;{inspectClaim.reviewer_notes}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Admin Intervention Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Enter notes explaining the administrative review decision..."
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    disabled={processing}
                    style={{
                      background: 'var(--bg-elevated-2)',
                      border: '1px solid var(--border-hair)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      padding: '0.65rem',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setInspectClaim(null)}
                className="admin-btn admin-btn-secondary"
                disabled={processing}
              >
                Close
              </button>

              {inspectClaim.status !== 'APPROVED' && inspectClaim.status !== 'REJECTED' && inspectClaim.status !== 'CANCELLED' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecuteReview('REJECT')}
                    className="admin-btn admin-btn-danger"
                    disabled={processing}
                  >
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <><XCircle size={15} /> Reject Claim</>}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExecuteReview('APPROVE')}
                    className="admin-btn admin-btn-success"
                    disabled={processing}
                  >
                    {processing ? <Loader2 size={15} className="animate-spin" /> : <><CheckCircle2 size={15} /> Approve Claim</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
