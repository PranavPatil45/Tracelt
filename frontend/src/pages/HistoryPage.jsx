import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  History,
  ShieldCheck,
  PackageCheck,
  Clock,
  Search,
  MapPin,
  Calendar,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import { getHistory, getHistoryStats } from '../api/recovery'
import './HistoryPage.css'

export default function HistoryPage() {
  const { token, user, logout, loading: authLoading, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [counts, setCounts] = useState({})
  const [stats, setStats] = useState({ recovered_count: 0, returned_count: 0, pending_action_count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters & Search
  const [activeTab, setActiveTab] = useState('all') // 'all', 'claimant', 'finder'
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 15

  // Route protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const fetchData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [histData, statsData] = await Promise.all([
        getHistory(
          {
            page,
            limit,
            role: activeTab === 'all' ? undefined : activeTab,
          },
          token
        ),
        getHistoryStats(token),
      ])

      setHistoryItems(histData.items || [])
      setTotal(histData.total || 0)
      setCounts(histData.counts || {})
      setStats(statsData)
    } catch (err) {
      setError(err.message || 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [token, activeTab, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredItems = historyItems.filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.title?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.location?.toLowerCase().includes(q) ||
      item.return_location?.toLowerCase().includes(q)
    )
  })

  if (!user && authLoading) {
    return (
      <div className="history-page-content" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="history-spinner"></div>
      </div>
    )
  }

  return (
    <div className="dashboard-app">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab="history"
        setActiveTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main App Workspace */}
      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Recovery History"
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content history-page-content">
          <div className="history-page-wrapper">
            {/* Header Banner */}
            <div className="history-header">
              <div>
                <div className="history-pill">
                  <History size={13} />
                  <span>Campus Recovery Ledger</span>
                </div>
                <h1 className="history-title">
                  Recovery History
                </h1>
                <p className="history-subtitle">
                  Your campus recovery milestone log and returned items
                </p>
              </div>

              <div className="history-header-actions">
                <Link to="/dashboard" className="btn-back">
                  Back to Dashboard
                </Link>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="history-stats-grid">
              {/* Items Recovered */}
              <div className="history-stat-card">
                <div className="history-stat-icon history-stat-icon--green">
                  <ShieldCheck size={24} />
                </div>
                <div className="history-stat-info">
                  <span className="history-stat-label">Items Recovered</span>
                  <span className="history-stat-value">{stats.recovered_count}</span>
                  <span className="history-stat-sub">Items safely returned to you</span>
                </div>
              </div>

              {/* Items Returned */}
              <div className="history-stat-card">
                <div className="history-stat-icon history-stat-icon--cyan">
                  <PackageCheck size={24} />
                </div>
                <div className="history-stat-info">
                  <span className="history-stat-label">Items Returned</span>
                  <span className="history-stat-value">{stats.returned_count}</span>
                  <span className="history-stat-sub">Found items you handed back</span>
                </div>
              </div>

              {/* Pending Handover */}
              <div className="history-stat-card">
                <div className="history-stat-icon history-stat-icon--amber">
                  <Clock size={24} />
                </div>
                <div className="history-stat-info">
                  <span className="history-stat-label">Pending Handover</span>
                  <span className="history-stat-value">{stats.pending_action_count}</span>
                  <span className="history-stat-sub">Awaiting return or confirmation</span>
                </div>
              </div>
            </div>

            {/* Toolbar: Segmented Tabs & Search Box */}
            <div className="history-toolbar">
              {/* Segmented Filter Pills */}
              <div className="history-tabs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('all')
                    setPage(1)
                  }}
                  className={`history-tab-btn ${activeTab === 'all' ? 'history-tab-btn--active' : ''}`}
                >
                  All Activity
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('claimant')
                    setPage(1)
                  }}
                  className={`history-tab-btn ${activeTab === 'claimant' ? 'history-tab-btn--active' : ''}`}
                >
                  Items I Recovered
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('finder')
                    setPage(1)
                  }}
                  className={`history-tab-btn ${activeTab === 'finder' ? 'history-tab-btn--active' : ''}`}
                >
                  Items I Returned
                </button>
              </div>

              {/* Search Box */}
              <div className="history-search-wrap">
                <Search size={15} className="history-search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, location..."
                  className="history-search-input"
                />
              </div>
            </div>

            {/* Content Area */}
            {loading ? (
              <div className="history-loading-card">
                <div className="history-spinner"></div>
                <p>Loading recovery records...</p>
              </div>
            ) : error ? (
              <div className="history-error-card">
                <AlertCircle size={32} />
                <p>{error}</p>
                <button type="button" className="btn-back" onClick={fetchData}>
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              /* Styled Empty State Card */
              <div className="history-empty-card">
                <div className="history-empty-icon-box">
                  <History size={28} />
                </div>
                <h3 className="history-empty-title">No History Records Found</h3>
                <p className="history-empty-desc">
                  {searchQuery
                    ? 'No recovered or returned items match your search query.'
                    : activeTab === 'claimant'
                    ? "You haven't recovered any lost items yet. Once an approved claim is handed over and confirmed, it appears here."
                    : activeTab === 'finder'
                    ? "You haven't returned any found items yet. Handed over items will appear here."
                    : 'All your completed Lost and Found recoveries and handovers will be safely recorded here.'}
                </p>
                <div style={{ marginTop: '8px' }}>
                  <Link to="/dashboard" className="btn-back">
                    Return to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              /* History Cards List */
              <div className="history-list">
                {filteredItems.map((item) => {
                  const isRec = item.status === 'RECOVERED'
                  const isRet = item.status === 'RETURNED'
                  const isUserClaimant = item.user_role === 'claimant' || item.type === 'LOST'

                  return (
                    <div
                      key={`${item.type}_${item.id}_${item.recovery_id || ''}`}
                      className="history-card"
                    >
                      <div className="history-card-left">
                        {/* Thumbnail / Category Icon */}
                        <div className="history-thumb-box">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="history-thumb-img"
                            />
                          ) : (
                            <div
                              className={`history-thumb-icon ${
                                isUserClaimant
                                  ? 'history-thumb-icon--claimant'
                                  : 'history-thumb-icon--finder'
                              }`}
                            >
                              {isUserClaimant ? <ShieldCheck size={28} /> : <PackageCheck size={28} />}
                            </div>
                          )}
                        </div>

                        {/* Item Details */}
                        <div className="history-card-details">
                          <div className="history-badges-row">
                            <span
                              className={`history-role-tag ${
                                isUserClaimant
                                  ? 'history-role-tag--claimant'
                                  : 'history-role-tag--finder'
                              }`}
                            >
                              {isUserClaimant ? 'Recovered by You' : 'Returned by You'}
                            </span>

                            <span
                              className={`history-status-badge ${
                                isRec
                                  ? 'history-status-badge--recovered'
                                  : isRet
                                  ? 'history-status-badge--returned'
                                  : 'history-status-badge--pending'
                              }`}
                            >
                              {item.status}
                            </span>

                            <span className="history-category-label">{item.category}</span>
                          </div>

                          <h3 className="history-item-title">{item.title}</h3>

                          <div className="history-meta-row">
                            <span className="history-meta-item">
                              <MapPin size={13} />
                              <span>{item.return_location ? `Handover: ${item.return_location}` : item.location}</span>
                            </span>
                            {item.completed_at && (
                              <span className="history-meta-item">
                                <Calendar size={13} />
                                <span>
                                  {new Date(item.completed_at).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action */}
                      <div className="history-card-right">
                        {item.recovery_id ? (
                          <Link
                            to={`/recovery/${item.recovery_id}`}
                            className="history-action-btn"
                          >
                            <span>Lifecycle Tracker</span>
                            <ChevronRight size={14} />
                          </Link>
                        ) : (
                          <Link
                            to={item.type === 'LOST' ? `/lost-items/${item.id}` : `/found-items/${item.id}`}
                            className="history-action-btn"
                          >
                            <span>View Report</span>
                            <ExternalLink size={13} />
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {total > limit && (
              <div className="history-pagination">
                <span>
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} records
                </span>
                <div className="history-pagination-btns">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="history-page-btn"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="history-page-btn"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
