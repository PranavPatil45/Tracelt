import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchReviewerCases } from '../../api/reviewer.js'
import {
  Layers,
  Search,
  Filter,
  ArrowRight,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileCheck,
} from 'lucide-react'
import './ReviewerPages.css'

export default function ReviewerCases() {
  const { token } = useAuth()
  const [cases, setCases] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [caseType, setCaseType] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const loadCases = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetchReviewerCases(token, {
        case_type: caseType,
        status: statusFilter,
        search: search.trim() || undefined,
        page,
        limit: 15,
      })
      setCases(res.cases || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load assigned cases:', err)
    } finally {
      setLoading(false)
    }
  }, [token, caseType, statusFilter, search, page])

  useEffect(() => {
    loadCases()
  }, [loadCases])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setPage(1)
    loadCases()
  }

  const totalPages = Math.ceil(total / 15) || 1

  return (
    <div className="reviewer-container">
      {/* Header */}
      <div className="reviewer-header-bar">
        <div>
          <h1>My Assigned Cases</h1>
          <p>Claims, ownership verification investigations, and disputed recoveries assigned to you.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="reviewer-toolbar">
        {/* Case Type Filter */}
        <div className="reviewer-toolbar__filters">
          <button
            className={`reviewer-filter-btn ${caseType === 'ALL' ? 'reviewer-filter-btn--active' : ''}`}
            onClick={() => { setCaseType('ALL'); setPage(1); }}
          >
            All Types
          </button>
          <button
            className={`reviewer-filter-btn ${caseType === 'CLAIM' ? 'reviewer-filter-btn--active' : ''}`}
            onClick={() => { setCaseType('CLAIM'); setPage(1); }}
          >
            Claims
          </button>
          <button
            className={`reviewer-filter-btn ${caseType === 'RECOVERY' ? 'reviewer-filter-btn--active' : ''}`}
            onClick={() => { setCaseType('RECOVERY'); setPage(1); }}
          >
            Disputes & Recoveries
          </button>
        </div>

        {/* Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="reviewer-search-input"
            style={{ width: 'auto', cursor: 'pointer' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="DISPUTED">Disputed</option>
          </select>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="text"
              placeholder="Search title, claimant, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="reviewer-search-input"
            />
            <button
              type="submit"
              className="reviewer-filter-btn reviewer-filter-btn--active"
              style={{ padding: '0.45rem 0.75rem' }}
            >
              <Search size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* Cases List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '30vh', gap: '0.75rem' }}>
          <Loader2 className="animate-spin" size={28} style={{ color: 'var(--cyan)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading assigned cases&hellip;</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="reviewer-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <FileCheck size={44} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Cases Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            No assigned cases match your current filters. Adjust your filters or check back later.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {cases.map((c) => {
            const isUrgent = c.is_urgent || c.is_competing || c.review_status === 'DISPUTED'
            const isClaim = c.case_type === 'CLAIM'
            return (
              <div
                key={`${c.case_type}-${c.case_id}`}
                className="reviewer-card"
                style={{
                  borderLeft: isUrgent ? '3px solid #ef4444' : '3px solid var(--cyan)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    {c.item_image ? (
                      <img
                        src={c.item_image}
                        alt={c.item_title}
                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-hair)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '8px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-hair)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Layers size={24} />
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: isClaim ? 'rgba(0, 242, 254, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                            color: isClaim ? 'var(--cyan)' : '#a855f7',
                          }}
                        >
                          {c.case_type} #{c.case_id}
                        </span>

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.item_category}
                        </span>

                        {isUrgent && <span className="badge-urgent">URGENT</span>}
                        {c.is_competing && <span className="badge-competing">COMPETING CLAIMS</span>}
                      </div>

                      <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                        {c.item_title}
                      </h3>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        <span>Claimant: <strong style={{ color: 'var(--text-primary)' }}>{c.claimant_name}</strong></span>
                        {c.finder_name && (
                          <span style={{ marginLeft: '1rem' }}>
                            Finder: <strong style={{ color: 'var(--text-primary)' }}>{c.finder_name}</strong>
                          </span>
                        )}
                        {c.assigned_at && (
                          <span style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>
                            Assigned: {new Date(c.assigned_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`badge-status badge-status--${(c.status || '').toLowerCase()}`}>
                        Status: {c.status}
                      </span>
                      {c.review_status && c.review_status !== 'NOT_REQUIRED' && (
                        <span className={`badge-status badge-status--${(c.review_status || '').toLowerCase()}`}>
                          Review: {c.review_status}
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/reviewer/cases/${c.case_type}/${c.case_id}`}
                      className="reviewer-filter-btn reviewer-filter-btn--active"
                      style={{
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      <span>Open Workspace</span>
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="reviewer-filter-btn"
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="reviewer-filter-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
