import { Menu, MapPin, Bell } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AdminHeader({ title, user, onToggleSidebar }) {
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD'

  return (
    <header className="admin-header">
      <div className="admin-header__left">
        <button
          className="admin-header__menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>
        <h2 className="admin-header__title">{title || 'Admin Dashboard'}</h2>
      </div>

      <div className="admin-header__right">
        {/* Campus Scope Indicator */}
        <div className="admin-campus-badge" title="Administrator Campus Scope">
          <MapPin size={14} />
          <span>{user?.campus || 'Global / All Campuses'}</span>
        </div>

        {/* Notifications */}
        <Link
          to="/notifications"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-hair)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
          title="Campus Notifications"
        >
          <Bell size={17} />
        </Link>

        {/* Admin Profile Pill */}
        <div className="admin-user-pill">
          <div className="admin-user-avatar">{initials}</div>
          <span className="admin-user-name">{user?.full_name || 'Admin'}</span>
          <span className="admin-role-badge">{user?.role || 'Admin'}</span>
        </div>
      </div>
    </header>
  )
}
