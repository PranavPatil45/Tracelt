import { Link, useLocation } from 'react-router-dom'
import {
  FileCheck,
  LayoutDashboard,
  Shield,
  Layers,
  ArrowLeft,
  LogOut,
  X,
  Compass,
} from 'lucide-react'

const REVIEWER_NAV_ITEMS = [
  { path: '/reviewer', label: 'Reviewer Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/reviewer/cases', label: 'My Assigned Cases', icon: Layers },
]

export default function ReviewerSidebar({ user, mobileOpen, setMobileOpen, onLogout }) {
  const location = useLocation()
  const userRole = (user?.role || '').trim().toLowerCase()
  const isAdmin = ['admin', 'superadmin', 'administrator'].includes(userRole)

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`admin-backdrop ${mobileOpen ? 'admin-backdrop--visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`admin-sidebar ${mobileOpen ? 'admin-sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__logo-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <FileCheck size={20} />
          </div>
          <div className="admin-sidebar__brand-text">
            <h1>TRACELT</h1>
            <span style={{ color: '#10b981' }}>Reviewer Workspace</span>
          </div>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="admin-sidebar__nav">
          {REVIEWER_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`admin-nav-item ${isActive ? 'admin-nav-item--active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {isAdmin && (
            <Link
              to="/admin/assignments"
              onClick={() => setMobileOpen(false)}
              className="admin-nav-item"
              style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.75rem' }}
            >
              <Shield size={18} style={{ color: 'var(--cyan)' }} />
              <span style={{ color: 'var(--cyan)' }}>Admin Assignment Desk</span>
            </Link>
          )}
        </nav>

        {/* Footer Actions */}
        <div className="admin-sidebar__footer">
          <Link to="/dashboard" className="admin-footer-btn">
            <ArrowLeft size={16} />
            <span>Back to Tracelt</span>
          </Link>

          <button onClick={onLogout} className="admin-footer-btn admin-footer-btn--logout">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
