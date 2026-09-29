import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Menu,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  MapPin,
  ExternalLink,
  Check,
  CheckCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationRoute,
  formatTimeAgo,
} from '../../api/notifications.js'
import './DashboardHeader.css'

export default function DashboardHeader({
  activeTabTitle = 'Dashboard',
  user,
  logout,
  notifications: propNotifications,
  onOpenNotifications,
  onOpenReportModal,
  onOpenMobileMenu,
  onSelectTab,
}) {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notifMenuOpen, setNotifMenuOpen] = useState(false)
  const [liveUnreadCount, setLiveUnreadCount] = useState(0)
  const [liveNotifications, setLiveNotifications] = useState([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  const profileRef = useRef(null)
  const notifRef = useRef(null)

  // Fetch unread count
  const refreshUnreadCount = useCallback(async () => {
    if (!token) return
    try {
      const count = await getUnreadCount(token)
      setLiveUnreadCount(count)
    } catch {
      // Non-blocking
    }
  }, [token])

  // Initial and periodic unread count poll
  useEffect(() => {
    refreshUnreadCount()
    const interval = setInterval(refreshUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [refreshUnreadCount])

  // Fetch recent notifications when dropdown opens
  const loadRecentNotifications = useCallback(async () => {
    if (!token) return
    setLoadingNotifs(true)
    try {
      const res = await getNotifications({ page: 1, limit: 6 }, token)
      setLiveNotifications(res.notifications || [])
      setLiveUnreadCount(res.unread_count || 0)
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingNotifs(false)
    }
  }, [token])

  useEffect(() => {
    if (notifMenuOpen) {
      loadRecentNotifications()
    }
  }, [notifMenuOpen, loadRecentNotifications])

  // Handle Mark All Read in Dropdown
  async function handleMarkAllRead() {
    if (!token) return
    try {
      await markAllAsRead(token)
      setLiveUnreadCount(0)
      setLiveNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
    } catch {
      // Non-blocking
    }
  }

  // Handle clicking a single notification
  async function handleNotificationClick(notif) {
    setNotifMenuOpen(false)
    if (!notif.is_read && token) {
      try {
        await markAsRead(notif.id, token)
        setLiveUnreadCount((c) => Math.max(0, c - 1))
        setLiveNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        )
      } catch {
        // Continue navigation even if mark read fails
      }
    }
    const route = getNotificationRoute(notif)
    navigate(route)
  }

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  // Items to display in dropdown (prefer real fetched notifications, fallback to props)
  const displayItems = liveNotifications.length > 0
    ? liveNotifications
    : (propNotifications && propNotifications.length > 0 ? propNotifications : [])

  return (
    <header className="dash-header">
      <div className="dash-header__left">
        {onOpenMobileMenu && (
          <button
            type="button"
            className="dash-header__mobile-toggle"
            onClick={onOpenMobileMenu}
            aria-label="Open Navigation Menu"
          >
            <Menu size={22} />
          </button>
        )}

        <div className="dash-header__titles">
          <h1 className="dash-header__title">{activeTabTitle}</h1>
          <div className="dash-header__campus-badge">
            <MapPin size={13} className="dash-header__campus-icon" />
            <span>{user?.campus || 'Campus Member'}</span>
          </div>
        </div>
      </div>

      <div className="dash-header__right">
        {/* Notification Bell with Dropdown */}
        <div className="dash-header__popover-container" ref={notifRef}>
          <button
            type="button"
            className={`dash-header__icon-btn ${notifMenuOpen ? 'dash-header__icon-btn--active' : ''}`}
            onClick={() => setNotifMenuOpen((prev) => !prev)}
            aria-label="Notifications"
            aria-expanded={notifMenuOpen}
          >
            <Bell size={19} />
            {liveUnreadCount > 0 && (
              <span className="dash-header__notif-badge">{liveUnreadCount}</span>
            )}
          </button>

          {notifMenuOpen && (
            <div className="dash-header__dropdown notif-dropdown">
              <div className="notif-dropdown__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="notif-dropdown__title">Notifications</span>
                  {liveUnreadCount > 0 && (
                    <span className="notif-dropdown__counter">{liveUnreadCount} new</span>
                  )}
                </div>

                {liveUnreadCount > 0 && (
                  <button
                    type="button"
                    className="notif-dropdown__mark-all-btn"
                    onClick={handleMarkAllRead}
                    title="Mark all as read"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="notif-dropdown__list">
                {loadingNotifs && displayItems.length === 0 ? (
                  <div className="notif-dropdown__empty">Loading updates...</div>
                ) : displayItems.length === 0 ? (
                  <div className="notif-dropdown__empty">
                    <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>🔔</span>
                    You&rsquo;re all caught up!
                  </div>
                ) : (
                  displayItems.map((n) => {
                    const isUnread = !n.is_read && n.unread !== false
                    return (
                      <div
                        key={n.id}
                        className={`notif-dropdown__item ${isUnread ? 'notif-dropdown__item--unread' : ''}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="notif-dropdown__item-content">
                          <div className="notif-dropdown__item-title">{n.title}</div>
                          <div className="notif-dropdown__item-desc">{n.message || n.description}</div>
                          <div className="notif-dropdown__item-time">
                            {n.created_at ? formatTimeAgo(n.created_at) : (n.time || 'Recently')}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="notif-dropdown__footer">
                <button
                  type="button"
                  className="notif-dropdown__all-btn"
                  onClick={() => {
                    setNotifMenuOpen(false)
                    navigate('/notifications')
                  }}
                >
                  View All Notifications &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="dash-header__popover-container" ref={profileRef}>
          <button
            type="button"
            className="dash-header__profile-btn"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-expanded={profileMenuOpen}
          >
            <div className="dash-header__avatar">{initials}</div>
            <span className="dash-header__name">
              {user?.full_name || 'Student Member'}
            </span>
            <ChevronDown
              size={15}
              className={`dash-header__chevron ${profileMenuOpen ? 'dash-header__chevron--open' : ''}`}
            />
          </button>

          {profileMenuOpen && (
            <div className="dash-header__dropdown profile-dropdown">
              <div className="profile-dropdown__user-info">
                <div className="profile-dropdown__name">{user?.full_name}</div>
                <div className="profile-dropdown__email">{user?.email}</div>
                <div className="profile-dropdown__dept">
                  {user?.department || 'Department Member'}
                </div>
              </div>

              <div className="profile-dropdown__divider" />

              <div className="profile-dropdown__menu">
                <button
                  type="button"
                  className="profile-dropdown__item"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    if (onSelectTab) onSelectTab('profile')
                  }}
                >
                  <User size={16} /> My Campus Profile
                </button>

                <button
                  type="button"
                  className="profile-dropdown__item"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    if (onSelectTab) onSelectTab('settings')
                  }}
                >
                  <Settings size={16} /> Preferences
                </button>

                <div className="profile-dropdown__divider" />

                <button
                  type="button"
                  className="profile-dropdown__item profile-dropdown__item--danger"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    if (logout) logout()
                    navigate('/login')
                  }}
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
