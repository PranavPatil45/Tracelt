import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import ReviewerSidebar from './ReviewerSidebar.jsx'
import AdminHeader from '../admin/AdminHeader.jsx'
import '../admin/AdminLayout.css'

const SECTION_TITLES = {
  '/reviewer/cases': 'Assigned Cases Queue',
  '/reviewer': 'Reviewer Workspace & Statistics',
}

export default function ReviewerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()

  let currentTitle = 'Reviewer Workspace'
  for (const [path, title] of Object.entries(SECTION_TITLES)) {
    if (path === '/reviewer' ? location.pathname === '/reviewer' : location.pathname.startsWith(path)) {
      currentTitle = title
      break
    }
  }

  return (
    <div className="admin-shell">
      <ReviewerSidebar
        user={user}
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
