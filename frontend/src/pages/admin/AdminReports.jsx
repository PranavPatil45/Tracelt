import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminReports, updateAdminReport } from '../../api/admin.js'
import AdminTable from '../../components/admin/AdminTable.jsx'
import { Flag, Eye, CheckCircle2, XCircle, X, Loader2 } from 'lucide-react'
import './AdminPages.css'

export default function AdminReports() {
  const { token } = useAuth()
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Review modal
  const [inspectReport, setInspectReport] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [updating, setUpdating] = useState(false)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminReports(token, {
        status: statusFilter,
        page,
        limit: 15,
      })
      setReports(res.reports || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, page])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  function handleOpenInspect(report) {
    setInspectReport(report)
    setAdminNotes(report.admin_notes || '')
  }

  async function handleResolve(targetStatus) {
    if (!inspectReport) return
    setUpdating(true)
    try {
      await updateAdminReport(token, inspectReport.id, {
        status: targetStatus,
        admin_notes: adminNotes,
      })
      setInspectReport(null)
      loadReports()
    } catch (err) {
      alert(err.message || 'Failed to update report.')
    } finally {
      setUpdating(false)
    }
  }

  const columns = [
    {
      key: 'entity',
      label: 'Target Entity',
      render: (r) => (
        <div>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', textTransform: 'capitalize', display: 'block' }}>
            {r.entity_type.replace('_', ' ')} #{r.entity_id}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Report #{r.id}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Report Reason',
      render: (r) => (
        <div>
          <span className="admin-badge admin-badge--closed" style={{ textTransform: 'capitalize' }}>
            {r.reason.replace('_', ' ')}
          </span>
          {r.description && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', maxWidth: '280px' }}>
              {r.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'reporter',
      label: 'Reporter',
      render: (r) => <span style={{ fontSize: '0.85rem' }}>{r.reporter_name}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        let badgeClass = 'admin-badge--pending'
        if (r.status === 'RESOLVED') badgeClass = 'admin-badge--active'
        if (r.status === 'DISMISSED') badgeClass = 'admin-badge--hidden'
        return <span className={`admin-badge ${badgeClass}`}>{r.status}</span>
      },
    },
    {
      key: 'created_at',
      label: 'Reported At',
      render: (r) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {new Date(r.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <button
          onClick={() => handleOpenInspect(r)}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '0.35rem 0.65rem' }}
          title="Inspect and resolve report"
        >
          <Eye size={14} /> Review
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Moderation &amp; Dispute Queue</h2>
          <p>Review community reports, flagged items, and enforce platform standards.</p>
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
            <option value="PENDING">Pending Attention</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
      </div>

      <AdminTable
        columns={columns}
        data={reports}
        loading={loading}
        page={page}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No reports awaiting moderation in this queue."
      />

      {/* Review & Resolution Modal */}
      {inspectReport && (
        <div className="admin-modal-overlay" onClick={() => setInspectReport(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Flag size={18} style={{ color: '#ef4444' }} />
                Review Report #{inspectReport.id}
              </h3>
              <button
                onClick={() => setInspectReport(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Reported Entity
                  </span>
                  <strong>{inspectReport.entity_type.replace('_', ' ').toUpperCase()} #{inspectReport.entity_id}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Filed By
                  </span>
                  <strong>{inspectReport.reporter_name}</strong>
                </div>
              </div>

              <div style={{ background: 'var(--bg-elevated-2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Allegation / Reason: {inspectReport.reason.replace('_', ' ')}
                </span>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {inspectReport.description || 'No additional narrative description provided.'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Admin Resolution Notes</label>
                <textarea
                  rows={3}
                  placeholder="Notes explaining administrative review action taken..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  disabled={updating}
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
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setInspectReport(null)}
                className="admin-btn admin-btn-secondary"
                disabled={updating}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => handleResolve('DISMISSED')}
                className="admin-btn admin-btn-danger"
                disabled={updating}
              >
                {updating ? <Loader2 size={15} className="animate-spin" /> : <><XCircle size={15} /> Dismiss Report</>}
              </button>

              <button
                type="button"
                onClick={() => handleResolve('RESOLVED')}
                className="admin-btn admin-btn-success"
                disabled={updating}
              >
                {updating ? <Loader2 size={15} className="animate-spin" /> : <><CheckCircle2 size={15} /> Mark Resolved</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
