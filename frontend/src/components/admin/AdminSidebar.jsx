import { Link, useLocation } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  Users,
  Search,
  CheckCircle2,
  Sparkles,
  FileCheck2,
  RotateCcw,
  Flag,
  Settings,
  ArrowLeft,
  LogOut,
  X,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/lost-items', label: 'Lost Items', icon: Search },
  { path: '/admin/found-items', label: 'Found Items', icon: CheckCircle2 },
  { path: '/admin/matches', label: 'Matches', icon: Sparkles },
  { path: '/admin/claims', label: 'Claims', icon: FileCheck2 },
  { path: '/admin/recoveries', label: 'Recoveries', icon: RotateCcw },
  { path: '/admin/reports', label: 'Reports', icon: Flag },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar({ mobileOpen, setMobileOpen, onLogout }) {
  const location = useLocation()

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
          <div className="admin-sidebar__logo-badge">
            <Shield size={20} />
          </div>
          <div className="admin-sidebar__brand-text">
            <h1>TRACELT</h1>
            <span>Admin Portal</span>
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
          {NAV_ITEMS.map((item) => {
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
