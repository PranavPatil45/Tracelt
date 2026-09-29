import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { ShieldAlert, ArrowLeft, LogOut, Loader2 } from 'lucide-react'

const ADMIN_ROLES = ['admin', 'superadmin', 'administrator']

export default function AdminProtectedRoute({ children }) {
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
        <p style={{ color: 'var(--text-secondary)' }}>Verifying administrative privileges&hellip;</p>
      </div>
    )
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const userRole = (user.role || '').trim().toLowerCase()
  const isAuthorized = ADMIN_ROLES.includes(userRole)

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
          borderRadius: 'var(--radius-md)',
          padding: '2.5rem',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#ef4444'
          }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            Admin Access Restricted
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            You don't have permission to access the Tracelt Admin Dashboard.
            Your account is registered with the role <strong style={{ color: 'var(--cyan)' }}>{user.role || 'student'}</strong>.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-elevated-2)',
                border: '1px solid var(--border-hair)',
                color: 'var(--text-primary)',
                padding: '0.65rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>

            <button
              onClick={logout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                padding: '0.65rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              <LogOut size={16} /> Switch Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  return children
}
