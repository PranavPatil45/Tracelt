import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { ShieldAlert, ArrowLeft, LogOut, Loader2 } from 'lucide-react'

const REVIEWER_ROLES = ['reviewer', 'admin', 'superadmin', 'administrator']

export default function ReviewerProtectedRoute({ children }) {
  const { user, token, loading, logout } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        gap: '1rem'
      }}>
        <Loader2 className="animate-spin" size={36} style={{ color: 'var(--cyan)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Verifying reviewer authorization&hellip;</p>
      </div>
    )
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userRole = (user.role || '').trim().toLowerCase()
  const isAuthorized = REVIEWER_ROLES.includes(userRole)

  if (!isAuthorized) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-void)',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          background: 'var(--bg-elevated)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          padding: '2.5rem',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: 'var(--red)'
          }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '0.75rem'
          }}>
            Reviewer Access Restricted
          </h2>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            marginBottom: '1.5rem'
          }}>
            Your account ({user.email}) has the role <code style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
              color: 'var(--cyan)'
            }}>{user.role || 'student'}</code>. Access to the dedicated Reviewer Workspace requires authorized Reviewer or Administrator privileges.
          </p>

          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                background: 'var(--cyan)',
                color: '#000',
                fontWeight: '600',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
            >
              <ArrowLeft size={16} />
              Return to Dashboard
            </Link>

            <button
              onClick={logout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-secondary)',
                fontWeight: '500',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return children
}
