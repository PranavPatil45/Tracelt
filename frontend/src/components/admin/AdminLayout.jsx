import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import AdminSidebar from './AdminSidebar.jsx'
import AdminHeader from './AdminHeader.jsx'
import './AdminLayout.css'

const SECTION_TITLES = {
  '/admin': 'Overview & Analytics',
  '/admin/users': 'User Management',
  '/admin/lost-items': 'Lost Items Moderation',
  '/admin/found-items': 'Found Items Moderation',
  '/admin/matches': 'Match Intelligence Monitoring',
  '/admin/claims': 'Claims & Ownership Verification',
  '/admin/recoveries': 'Recovery & Return Tracking',
  '/admin/reports': 'Moderation & Dispute Queue',
  '/admin/settings': 'Campus Settings & Audit Logs',
}

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()

  // Resolve current title
  let currentTitle = 'Admin Portal'
  for (const [path, title] of Object.entries(SECTION_TITLES)) {
    if (path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)) {
      currentTitle = title
      break
    }
  }

  return (
    <div className="admin-shell">
      <AdminSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={logout}
      />

      <div className="admin-main">
        <AdminHeader
          title={currentTitle}
          user={user}
          onToggleSidebar={() => setMobileOpen((prev) => !prev)}
        />

        <main className="admin-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
