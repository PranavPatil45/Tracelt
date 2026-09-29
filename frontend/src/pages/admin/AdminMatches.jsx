import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminMatches } from '../../api/admin.js'
import AdminTable from '../../components/admin/AdminTable.jsx'
import { Sparkles, Eye, X, Check, ArrowRight } from 'lucide-react'
import './AdminPages.css'

export default function AdminMatches() {
  const { token, user: currentAdmin } = useAuth()
  const [matches, setMatches] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedMatch, setSelectedMatch] = useState(null)

  const loadMatches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminMatches(token, {
        status: statusFilter,
        campus: currentAdmin?.campus,
        page,
        limit: 15,
      })
      setMatches(res.matches || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load matches:', err)
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, page, currentAdmin?.campus])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  const columns = [
    {
      key: 'match',
      label: 'Matched Item Pair',
      render: (m) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <span style={{ fontWeight: '600', color: 'var(--amber)', display: 'block' }}>
              Lost: {m.lost_item_title}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>#{m.lost_item_id} &bull; {m.lost_item_category}</span>
          </div>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: '600', color: 'var(--cyan)', display: 'block' }}>
              Found: {m.found_item_title}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>#{m.found_item_id} &bull; {m.found_item_category}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'score',
      label: 'Match Confidence',
      render: (m) => {
        let color = 'var(--cyan)'
        if (m.total_score >= 80) color = '#22c55e'
        else if (m.total_score < 60) color = 'var(--amber)'

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                fontSize: '1rem',
                color,
              }}
            >
              {m.total_score}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>score</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (m) => {
        let badgeClass = 'admin-badge--matched'
        if (m.status === 'REVIEWED') badgeClass = 'admin-badge--active'
        if (m.status === 'REJECTED') badgeClass = 'admin-badge--closed'
        return <span className={`admin-badge ${badgeClass}`}>{m.status}</span>
      },
    },
    {
      key: 'created_at',
      label: 'Identified At',
      render: (m) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {new Date(m.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (m) => (
        <button
          onClick={() => setSelectedMatch(m)}
          className="admin-btn admin-btn-secondary"
          style={{ padding: '0.35rem 0.65rem' }}
          title="Inspect signal score breakdown"
        >
          <Eye size={14} /> Score Details
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Match Intelligence Monitoring</h2>
          <p>Real-time algorithmically identified potential matches between lost and found items.</p>
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
            <option value="POSSIBLE">Possible Matches</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <AdminTable
        columns={columns}
        data={matches}
        loading={loading}
        page={page}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No matches recorded matching current criteria."
      />

      {/* Score Breakdown Modal */}
      {selectedMatch && (
        <div className="admin-modal-overlay" onClick={() => setSelectedMatch(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: 'var(--violet)' }} />
                Match #{selectedMatch.id} Breakdown ({selectedMatch.total_score}%)
              </h3>
              <button
                onClick={() => setSelectedMatch(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.88rem' }}>
                <div style={{ background: 'var(--bg-elevated-2)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--amber)', textTransform: 'uppercase', fontWeight: '700' }}>
                    Lost Item Report
                  </span>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{selectedMatch.lost_item_title}</p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Category: {selectedMatch.lost_item_category}</span>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Link to={`/lost-items/${selectedMatch.lost_item_id}`} style={{ color: 'var(--cyan)', fontSize: '0.82rem' }}>
                      Open Lost Details &rarr;
                    </Link>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-elevated-2)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--cyan)', textTransform: 'uppercase', fontWeight: '700' }}>
                    Found Item Report
                  </span>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{selectedMatch.found_item_title}</p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Category: {selectedMatch.found_item_category}</span>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Link to={`/found-items/${selectedMatch.found_item_id}`} style={{ color: 'var(--cyan)', fontSize: '0.82rem' }}>
                      Open Found Details &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Signal Scores Breakdown
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--cyan)' }}>{selectedMatch.category_score}/25</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Category</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--cyan)' }}>{selectedMatch.location_score}/25</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Location</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--cyan)' }}>{selectedMatch.date_score}/20</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Date</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--cyan)' }}>{selectedMatch.time_score}/10</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Time</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--cyan)' }}>{selectedMatch.description_score}/20</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Text Sim</span>
                  </div>
                </div>
              </div>

              {/* Reasons List */}
              <div>
                <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Match Explanations
                </h4>
                {selectedMatch.reasons && selectedMatch.reasons.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedMatch.reasons.map((r, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <Check size={14} style={{ color: '#22c55e' }} />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No explicit explanation reasons generated.</p>
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <button onClick={() => setSelectedMatch(null)} className="admin-btn admin-btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
