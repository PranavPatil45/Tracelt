import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchReviewerStats, fetchReviewerCases } from '../../api/reviewer.js'
import {
  FileCheck,
  Clock,
  Eye,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import './ReviewerPages.css'

export default function ReviewerDashboard() {
  const { token, user } = useAuth()
  const [stats, setStats] = useState(null)
  const [urgentCases, setUrgentCases] = useState([])
  const [recentCases, setRecentCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboardData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const statsData = await fetchReviewerStats(token)
      setStats(statsData)
      setUrgentCases(statsData.urgent_cases || [])

      const casesData = await fetchReviewerCases(token, { limit: 5 })
      setRecentCases(casesData.cases || [])
    } catch (err) {
      console.error('Failed to load reviewer dashboard:', err)
      setError(err.message || 'Failed to load reviewer dashboard metrics.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--cyan)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading Reviewer Workspace&hellip;</p>
      </div>
    )
  }

  return (
    <div className="reviewer-container">
      {/* Header Bar */}
      <div className="reviewer-header-bar">
        <div>
          <h1>Welcome, {user?.full_name || 'Reviewer'}</h1>
          <p>Assigned review queue, verification tasks, and dispute resolution.</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="reviewer-filter-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Urgent Alert Banner */}
      {urgentCases.length > 0 && (
        <div className="reviewer-urgent-banner">
          <div className="reviewer-urgent-banner__left">
            <span className="reviewer-urgent-banner__badge">ACTION REQUIRED</span>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <div>
              <span style={{ fontWeight: '600', display: 'block' }}>
                {urgentCases.length} Urgent Case{urgentCases.length > 1 ? 's' : ''} Require Immediate Intervention
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Active competing claims or disputed handovers currently assigned to you.
              </span>
            </div>
          </div>
          <Link
            to="/reviewer/cases"
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: '6px',
              background: '#ef4444',
              color: '#fff',
              fontWeight: '600',
              fontSize: '0.82rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Review Urgent Cases
          </Link>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="reviewer-stats-grid">
        <div className="reviewer-stat-card">
          <div className="reviewer-stat-card__label">
            <span>Total Assigned</span>
            <FileCheck size={16} style={{ color: 'var(--cyan)' }} />
          </div>
          <div className="reviewer-stat-card__value">{stats?.assigned_total ?? 0}</div>
        </div>

        <div className="reviewer-stat-card">
          <div className="reviewer-stat-card__label">
            <span>Pending Review</span>
            <Clock size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div className="reviewer-stat-card__value" style={{ color: '#f59e0b' }}>
            {stats?.pending_review ?? 0}
          </div>
        </div>

        <div className="reviewer-stat-card">
          <div className="reviewer-stat-card__label">
            <span>Under Review</span>
            <Eye size={16} style={{ color: '#3b82f6' }} />
          </div>
          <div className="reviewer-stat-card__value" style={{ color: '#3b82f6' }}>
            {stats?.under_review ?? 0}
          </div>
        </div>

        <div className="reviewer-stat-card">
          <div className="reviewer-stat-card__label">
            <span>Recovery Disputes</span>
            <ShieldAlert size={16} style={{ color: '#ef4444' }} />
          </div>
          <div className="reviewer-stat-card__value" style={{ color: '#ef4444' }}>
            {stats?.disputes_count ?? 0}
          </div>
        </div>

        <div className="reviewer-stat-card">
          <div className="reviewer-stat-card__label">
            <span>Resolved / Finalized</span>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          </div>
          <div className="reviewer-stat-card__value" style={{ color: '#10b981' }}>
            {stats?.completed_count ?? 0}
          </div>
        </div>
      </div>

      {/* Recent Assigned Cases */}
      <div className="reviewer-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="reviewer-card__title" style={{ border: 'none', padding: 0 }}>
            Recent Assigned Cases
          </h2>
          <Link
            to="/reviewer/cases"
            style={{
              fontSize: '0.85rem',
              color: 'var(--cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            <span>View All Cases</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {recentCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <FileCheck size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <p>No active cases currently assigned to you.</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              When administrators assign claims or disputed recoveries, they will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentCases.map((c) => {
              const isUrgent = c.is_urgent || c.is_competing || c.review_status === 'DISPUTED'
              return (
                <div
                  key={`${c.case_type}-${c.case_id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-hair)',
                    borderRadius: '8px',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: c.case_type === 'CLAIM' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                        color: c.case_type === 'CLAIM' ? 'var(--cyan)' : '#a855f7',
                      }}
                    >
                      {c.case_type} #{c.case_id}
                    </span>
                    <div>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                        {c.item_title}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Claimant: {c.claimant_name} {c.finder_name ? `• Finder: ${c.finder_name}` : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isUrgent && <span className="badge-urgent">URGENT</span>}
                    {c.is_competing && <span className="badge-competing">COMPETING</span>}
                    <span className={`badge-status badge-status--${(c.status || '').toLowerCase()}`}>
                      {c.status}
                    </span>

                    <Link
                      to={`/reviewer/cases/${c.case_type}/${c.case_id}`}
                      className="reviewer-filter-btn reviewer-filter-btn--active"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <span>Review</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
