import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminStats, fetchAdminActivity } from '../../api/admin.js'
import { formatTimeAgo } from '../../api/notifications.js'
import {
  Users,
  Search,
  CheckCircle2,
  GitCompare,
  Tag,
  FileCheck2,
  RotateCcw,
  Flag,
  ArrowRight,
  RefreshCw,
  Clock,
  MapPin,
  TrendingUp,
} from 'lucide-react'
import {
  LostVsFoundChart,
  CategoryDistributionChart,
  RecoveryRateGauge,
} from '../../components/admin/AdminChart.jsx'
import './AdminPages.css'

export default function AdminOverview() {
  const { token, user } = useAuth()
  const [stats, setStats] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const [statsData, actData] = await Promise.all([
        fetchAdminStats(token, user?.campus),
        fetchAdminActivity(token, { page: 1, limit: 10, campus: user?.campus }),
      ])
      setStats(statsData)
      setActivities(actData.items || [])
    } catch (err) {
      setError(err.message || 'Failed to load administrator dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, user?.campus])

  useEffect(() => {
    loadData()
  }, [loadData])

  function getActivityIcon(type) {
    switch (type) {
      case 'LOST_ITEM_CREATED':
        return { icon: Search, bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }
      case 'FOUND_ITEM_CREATED':
        return { icon: CheckCircle2, bg: 'rgba(69, 214, 224, 0.15)', color: 'var(--cyan)' }
      case 'MATCH_CREATED':
        return { icon: GitCompare, bg: 'rgba(140, 123, 255, 0.15)', color: 'var(--violet)' }
      case 'CLAIM_APPROVED':
        return { icon: FileCheck2, bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }
      case 'CLAIM_REJECTED':
        return { icon: FileCheck2, bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
      case 'ITEM_RECOVERED':
        return { icon: RotateCcw, bg: 'rgba(69, 214, 224, 0.15)', color: 'var(--cyan)' }
      case 'REPORT_SUBMITTED':
        return { icon: Flag, bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
      default:
        return { icon: Clock, bg: 'rgba(230, 236, 248, 0.1)', color: 'var(--text-secondary)' }
    }
  }

  return (
    <div>
      {/* Top Banner */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Campus Activity & Intelligence Overview</h2>
          <p>Real-time metrics, active traces, and moderation controls for {user?.campus || 'your campus'}</p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="admin-btn admin-btn-secondary"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          padding: '1rem',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button onClick={() => loadData(true)} className="admin-btn admin-btn-secondary" style={{ padding: '0.35rem 0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* 7 Metric Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Total Users</span>
            <div className="admin-stat-icon" style={{ background: 'rgba(140, 123, 255, 0.12)', color: 'var(--violet)' }}>
              <Users size={18} />
            </div>
          </div>
          <span className="admin-stat-value">{stats ? stats.total_users.toLocaleString() : '—'}</span>
          <span className="admin-stat-subtext">Registered campus accounts</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Lost Reports</span>
            <div className="admin-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)' }}>
              <Search size={18} />
            </div>
          </div>
          <span className="admin-stat-value">{stats ? stats.total_lost_items.toLocaleString() : '—'}</span>
          <span className="admin-stat-subtext">Total reported missing</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Found Items</span>
            <div className="admin-stat-icon" style={{ background: 'rgba(69, 214, 224, 0.12)', color: 'var(--cyan)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <span className="admin-stat-value">{stats ? stats.total_found_items.toLocaleString() : '—'}</span>
          <span className="admin-stat-subtext">Total reported spotted</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Active Matches</span>
            <div className="admin-stat-icon" style={{ background: 'rgba(140, 123, 255, 0.12)', color: 'var(--violet)' }}>
              <GitCompare size={18} />
            </div>
          </div>
          <span className="admin-stat-value">{stats ? stats.active_matches.toLocaleString() : '—'}</span>
          <span className="admin-stat-subtext">Possible item matches</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Pending Claims</span>
            <div className="admin-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <FileCheck2 size={18} />
            </div>
          </div>
          <span className="admin-stat-value">{stats ? stats.pending_claims.toLocaleString() : '—'}</span>
          <span className="admin-stat-subtext">Awaiting verification</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Recovered Items</span>
            <div className="admin-stat-icon" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>
              <RotateCcw size={18} />
            </div>
          </div>
          <span className="admin-stat-value">{stats ? stats.recovered_items.toLocaleString() : '—'}</span>
          <span className="admin-stat-subtext">Successfully returned</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Moderation Flags</span>
            <div className="admin-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
              <Flag size={18} />
            </div>
          </div>
          <span className="admin-stat-value">{stats ? stats.active_reports.toLocaleString() : '—'}</span>
          <span className="admin-stat-subtext">Reports in queue</span>
        </div>
      </div>

      {/* Analytics & Distribution Grid */}
      <div className="admin-grid-2col">
        {/* Left Column: Volume Ratio & Recovery Gauge */}
        <div className="admin-card">
          <h3 className="admin-card__title">
            <TrendingUp size={18} style={{ color: 'var(--cyan)' }} />
            Recovery & Reporting Metrics
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <RecoveryRateGauge
              rate={stats ? stats.recovery_rate : 0}
              recoveredCount={stats ? stats.recovered_items : 0}
              totalCount={stats ? stats.total_lost_items : 0}
            />

            <div>
              <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Lost vs. Found Reports
              </h4>
              <LostVsFoundChart
                lostCount={stats ? stats.total_lost_items : 0}
                foundCount={stats ? stats.total_found_items : 0}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Category Distribution */}
        <div className="admin-card">
          <h3 className="admin-card__title">
            <Tag size={18} style={{ color: 'var(--violet)' }} />
            Most Reported Item Categories
          </h3>

          <CategoryDistributionChart categories={stats?.top_categories || []} />

          {/* Top Campus Locations */}
          {stats?.top_locations && stats.top_locations.length > 0 && (
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-hair)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={14} style={{ color: 'var(--cyan)' }} /> Top Campus Locations
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {stats.top_locations.map((loc) => (
                  <span
                    key={loc.location}
                    style={{
                      background: 'var(--bg-elevated-2)',
                      border: '1px solid var(--border-hair)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {loc.location} <strong style={{ color: 'var(--cyan)', marginLeft: '0.25rem' }}>{loc.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent System Activity Section */}
      <div className="admin-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="admin-card__title">
            <Clock size={18} style={{ color: 'var(--amber)' }} />
            Recent Campus Activity
          </h3>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Latest {activities.length} events
          </span>
        </div>

        {activities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '1.5rem 0' }}>
            No recent activity recorded yet.
          </p>
        ) : (
          <div className="admin-activity-list">
            {activities.map((act) => {
              const info = getActivityIcon(act.type)
              const Icon = info.icon

              return (
                <div key={act.id} className="admin-activity-item">
                  <div className="admin-activity-icon" style={{ background: info.bg, color: info.color }}>
                    <Icon size={16} />
                  </div>

                  <div className="admin-activity-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="admin-activity-title">{act.title}</span>
                      <span className="admin-activity-time">{formatTimeAgo(act.created_at)}</span>
                    </div>
                    <span className="admin-activity-desc">{act.description}</span>
                    {act.user_name && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--cyan)' }}>
                        User: {act.user_name}
                      </span>
                    )}
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
