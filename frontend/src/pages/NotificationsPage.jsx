import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Bell,
  GitCompare,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  CheckCheck,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationRoute,
  formatTimeAgo,
} from '../api/notifications.js'
import { parseDate } from '../utils/dateUtils.js'
import './NotificationsPage.css'

export default function NotificationsPage() {
  const { user, token, loading: authLoading, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'unread', 'matches', 'claims', 'recoveries'
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Route protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const data = await getNotifications(
        {
          page: 1,
          limit: 50,
          filter: activeFilter === 'all' ? undefined : activeFilter,
        },
        token
      )
      setNotifications(data.notifications || [])
      setTotal(data.total || 0)
      setUnreadCount(data.unread_count || 0)
    } catch (err) {
      setError(err.message || 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [token, activeFilter])

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated, loadData])

  // Handle Mark All Read
  async function handleMarkAllRead() {
    if (!token) return
    try {
      await markAllAsRead(token)
      setUnreadCount(0)
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
    } catch (err) {
      alert(err.message || 'Could not mark all notifications as read.')
    }
  }

  // Handle Single Notification Click
  async function handleNotificationClick(notif) {
    if (!notif.is_read && token) {
      try {
        await markAsRead(notif.id, token)
        setUnreadCount((c) => Math.max(0, c - 1))
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        )
      } catch {
        // Non-blocking
      }
    }
    const targetRoute = getNotificationRoute(notif)
    navigate(targetRoute)
  }

  // Handle Delete Notification
  async function handleDelete(e, notifId) {
    e.stopPropagation()
    if (!token) return
    try {
      await deleteNotification(notifId, token)
      setNotifications((prev) => prev.filter((n) => n.id !== notifId))
      setTotal((t) => Math.max(0, t - 1))
    } catch (err) {
      alert(err.message || 'Failed to delete notification.')
    }
  }

  // Helper for notification type icons
  function getNotificationIcon(type) {
    switch (type) {
      case 'MATCH_FOUND':
        return (
          <div className="notif-icon-box notif-icon-box--match">
            <GitCompare size={20} />
          </div>
        )
      case 'CLAIM_SUBMITTED':
        return (
          <div className="notif-icon-box notif-icon-box--claim">
            <FileText size={20} />
          </div>
        )
      case 'CLAIM_APPROVED':
        return (
          <div className="notif-icon-box notif-icon-box--approved">
            <CheckCircle2 size={20} />
          </div>
        )
      case 'CLAIM_REJECTED':
        return (
          <div className="notif-icon-box notif-icon-box--rejected">
            <XCircle size={20} />
          </div>
        )
      case 'CLAIM_CANCELLED':
        return (
          <div className="notif-icon-box notif-icon-box--cancelled">
            <AlertCircle size={20} />
          </div>
        )
      case 'ITEM_RECOVERED':
        return (
          <div className="notif-icon-box notif-icon-box--recovered">
            <Award size={20} />
          </div>
        )
      default:
        return (
          <div className="notif-icon-box notif-icon-box--claim">
            <Bell size={20} />
          </div>
        )
    }
  }

  // Group notifications chronologically (Today, Yesterday, Earlier)
  function groupNotifications(items) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const groups = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    }

    items.forEach((item) => {
      const d = parseDate(item.created_at)
      if (!d) {
        groups.Earlier.push(item)
        return
      }
      d.setHours(0, 0, 0, 0)
      if (d.getTime() === today.getTime()) {
        groups.Today.push(item)
      } else if (d.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(item)
      } else {
        groups.Earlier.push(item)
      }
    })

    return groups
  }

  const grouped = groupNotifications(notifications)

  if (authLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading Tracelt Notifications&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="dashboard-app">
      <Sidebar
        activeTab="notifications"
        setActiveTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Notifications"
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content notif-page-content">
          <div className="notif-page-wrapper">
            {/* Header Title & Actions */}
            <div className="notif-header">
              <div>
                <div className="notif-pill">
                  <Bell size={13} />
                  <span>Activity Stream</span>
                </div>
                <h1 className="notif-title">Notifications</h1>
                <p className="notif-subtitle">
                  Real-time updates regarding your lost reports, found items, match alerts, and claims.
                </p>
              </div>

              {unreadCount > 0 && (
                <div className="notif-header-actions">
                  <button
                    type="button"
                    className="notif-mark-all-btn"
                    onClick={handleMarkAllRead}
                    title="Mark all notifications as read"
                  >
                    <CheckCheck size={16} />
                    <span>Mark all as read</span>
                  </button>
                </div>
              )}
            </div>

            {/* Filter Navigation Bar */}
            <div className="notif-filters-bar">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread', badge: unreadCount > 0 ? unreadCount : null },
                { id: 'matches', label: 'Matches' },
                { id: 'claims', label: 'Claims' },
                { id: 'recoveries', label: 'Recoveries' },
              ].map((filterItem) => (
                <button
                  key={filterItem.id}
                  type="button"
                  className={`notif-filter-pill ${activeFilter === filterItem.id ? 'notif-filter-pill--active' : ''}`}
                  onClick={() => setActiveFilter(filterItem.id)}
                >
                  <span>{filterItem.label}</span>
                  {filterItem.badge && (
                    <span className="notif-pill-count">{filterItem.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Content Display */}
            {loading ? (
              <div className="notif-list">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="notif-skeleton" />
                ))}
              </div>
            ) : error ? (
              <div className="notif-empty-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <AlertCircle size={36} color="#f87171" />
                <h3 className="notif-empty-title">Unable to Load Notifications</h3>
                <p className="notif-empty-desc">{error}</p>
                <button type="button" className="btn btn-secondary" onClick={loadData}>
                  Try Again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty-card">
                <div className="notif-empty-icon">
                  <Bell size={28} />
                </div>
                <h3 className="notif-empty-title">You&rsquo;re All Caught Up</h3>
                <p className="notif-empty-desc">
                  Important updates about your lost and found campus reports, match correlations, and ownership claims will appear here.
                </p>
                <div style={{ marginTop: '10px', display: 'flex', gap: '12px' }}>
                  <Link to="/explore" className="btn btn-secondary">
                    Explore Campus Items
                  </Link>
                  <Link to="/matches" className="btn btn-primary">
                    Check Match Center
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {Object.entries(grouped).map(([groupLabel, items]) => {
                  if (items.length === 0) return null
                  return (
                    <section key={groupLabel} className="notif-group">
                      <h2 className="notif-group-title">{groupLabel}</h2>
                      <div className="notif-list">
                        {items.map((notif) => (
                          <article
                            key={notif.id}
                            className={`notif-card ${!notif.is_read ? 'notif-card--unread' : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                          >
                            {!notif.is_read && <span className="notif-unread-dot" title="Unread" />}

                            {getNotificationIcon(notif.type)}

                            <div className="notif-content">
                              <div className="notif-title-row">
                                <h3 className="notif-item-title">{notif.title}</h3>
                              </div>
                              <p className="notif-message">{notif.message}</p>

                              <div className="notif-footer-meta">
                                <span>
                                  <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                                  {formatTimeAgo(notif.created_at)}
                                </span>
                                <span className="notif-action-tag">
                                  <span>View details</span>
                                  <ChevronRight size={13} />
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="notif-delete-btn"
                              onClick={(e) => handleDelete(e, notif.id)}
                              title="Delete notification"
                              aria-label="Delete notification"
                            >
                              <Trash2 size={15} />
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
