import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminAuditLogs } from '../../api/admin.js'
import AdminTable from '../../components/admin/AdminTable.jsx'
import { Settings, Shield, Server, FileText, CheckCircle2 } from 'lucide-react'
import './AdminPages.css'

export default function AdminSettings() {
  const { user: currentAdmin, token } = useAuth()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadAuditLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminAuditLogs(token, { page, limit: 15 })
      setLogs(res.logs || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [token, page])

  useEffect(() => {
    loadAuditLogs()
  }, [loadAuditLogs])

  const columns = [
    {
      key: 'action',
      label: 'Admin Action',
      render: (log) => (
        <div>
          <span style={{ fontWeight: '600', color: 'var(--cyan)' }}>{log.action}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
            Target: {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'admin',
      label: 'Executed By',
      render: (log) => <span style={{ fontSize: '0.85rem' }}>{log.admin_name || 'System'}</span>,
    },
    {
      key: 'details',
      label: 'Intervention Details',
      render: (log) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {log.details || '—'}
        </span>
      ),
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (log) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {new Date(log.created_at).toLocaleString()}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Campus Settings &amp; Audit Logs</h2>
          <p>System configuration, campus scope boundaries, and administrative accountability trail.</p>
        </div>
      </div>

      <div className="admin-grid-2col" style={{ marginBottom: '2rem' }}>
        {/* Campus Scope Card */}
        <div className="admin-card">
          <h3 className="admin-card__title">
            <Shield size={18} style={{ color: 'var(--cyan)' }} />
            Administrator Scope &amp; Boundary
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Assigned Campus</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {currentAdmin?.campus || 'Global / All Campuses'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Administrator Account</span>
              <span>{currentAdmin?.full_name} ({currentAdmin?.email})</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Authorization Level</span>
              <span className="admin-badge admin-badge--active">{currentAdmin?.role || 'Admin'}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginTop: '0.5rem' }}>
              All lost and found items, matches, claims, and reports displayed in this dashboard are strictly scoped to {currentAdmin?.campus || 'your campus'} to prevent cross-campus data exposure.
            </p>
          </div>
        </div>

        {/* System Architecture Info */}
        <div className="admin-card">
          <h3 className="admin-card__title">
            <Server size={18} style={{ color: 'var(--violet)' }} />
            System Architecture
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hair)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Platform Version:</span>
              <strong>Tracelt 1.0 (Smart Campus Portal)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hair)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Backend Framework:</span>
              <span>FastAPI (Python 3.12)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hair)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Matching Engine:</span>
              <span>Rule-Based Weighted Scoring (100 pts)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-hair)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Audit Logging:</span>
              <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={14} /> Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="admin-card">
        <h3 className="admin-card__title">
          <FileText size={18} style={{ color: 'var(--amber)' }} />
          Administrative Action Audit Log
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '-0.75rem' }}>
          Immutable audit record of administrative interventions including claim approvals, user status updates, and report resolutions.
        </p>

        <AdminTable
          columns={columns}
          data={logs}
          loading={loading}
          page={page}
          total={total}
          limit={15}
          onPageChange={(p) => setPage(p)}
          emptyMessage="No administrative actions logged yet."
        />
      </div>
    </div>
  )
}
