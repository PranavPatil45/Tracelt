import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchAdminUsers, fetchAdminUserDetail, updateAdminUser } from '../../api/admin.js'
import AdminTable from '../../components/admin/AdminTable.jsx'
import { Search, UserCheck, UserX, Shield, Edit, Eye, X, Loader2, AlertCircle } from 'lucide-react'
import './AdminPages.css'

export default function AdminUsers() {
  const { token, user: currentAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Modals
  const [selectedUserDetail, setSelectedUserDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editModalUser, setEditModalUser] = useState(null)
  const [newRole, setNewRole] = useState('')
  const [newStatus, setNewStatus] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [modalError, setModalError] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminUsers(token, {
        search,
        role: roleFilter,
        campus: currentAdmin?.campus,
        isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
        page,
        limit: 15,
      })
      setUsers(res.users || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }, [token, search, roleFilter, statusFilter, page, currentAdmin?.campus])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleOpenDetail(user) {
    setLoadingDetail(true)
    try {
      const detail = await fetchAdminUserDetail(token, user.id)
      setSelectedUserDetail(detail)
    } catch (err) {
      alert(err.message || 'Failed to fetch user details.')
    } finally {
      setLoadingDetail(false)
    }
  }

  function handleOpenEdit(user) {
    setEditModalUser(user)
    setNewRole(user.role || 'student')
    setNewStatus(user.is_active)
    setModalError('')
  }

  async function handleSaveUserUpdate(e) {
    e.preventDefault()
    if (!editModalUser) return
    setUpdating(true)
    setModalError('')

    try {
      await updateAdminUser(token, editModalUser.id, {
        role: newRole,
        is_active: newStatus,
      })
      setEditModalUser(null)
      loadUsers()
    } catch (err) {
      setModalError(err.message || 'Failed to update user.')
    } finally {
      setUpdating(false)
    }
  }

  const columns = [
    {
      key: 'user',
      label: 'User Profile',
      render: (u) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{u.full_name}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</span>
        </div>
      ),
    },
    {
      key: 'campus',
      label: 'Campus & Dept',
      render: (u) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '0.85rem' }}>{u.campus}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.department || 'N/A'}</span>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (u) => {
        const isAdm = u.role === 'admin'
        return (
          <span
            className="admin-badge"
            style={{
              background: isAdm ? 'rgba(140, 123, 255, 0.15)' : 'var(--bg-elevated-2)',
              color: isAdm ? 'var(--violet)' : 'var(--text-secondary)',
              border: isAdm ? '1px solid rgba(140, 123, 255, 0.3)' : '1px solid var(--border-hair)',
            }}
          >
            {u.role}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (u) => (
        <span className={`admin-badge ${u.is_active ? 'admin-badge--active' : 'admin-badge--closed'}`}>
          {u.is_active ? 'Active' : 'Suspended'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (u) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {new Date(u.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (u) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => handleOpenDetail(u)}
            className="admin-btn admin-btn-secondary"
            style={{ padding: '0.35rem 0.65rem' }}
            title="Inspect user details"
          >
            <Eye size={14} /> View
          </button>
          <button
            onClick={() => handleOpenEdit(u)}
            className="admin-btn admin-btn-secondary"
            style={{ padding: '0.35rem 0.65rem' }}
            title="Edit role and status"
          >
            <Edit size={14} /> Edit
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>User Account Management</h2>
          <p>Search, inspect profiles, update roles, and manage account statuses.</p>
        </div>
      </div>

      {/* Toolbar: Search and Filters */}
      <div className="admin-toolbar">
        <div className="admin-search-box">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by full name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="admin-search-input"
          />
        </div>

        <div className="admin-filter-group">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
            className="admin-select"
          >
            <option value="ALL">All Roles</option>
            <option value="student">Student</option>
            <option value="contributor">Contributor</option>
            <option value="reviewer">Reviewer</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="admin-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <AdminTable
        columns={columns}
        data={users}
        loading={loading}
        page={page}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
        emptyMessage="No users found matching your search and filter criteria."
      />

      {/* User Detail Modal */}
      {selectedUserDetail && (
        <div className="admin-modal-overlay" onClick={() => setSelectedUserDetail(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>User Profile &amp; History</h3>
              <button
                onClick={() => setSelectedUserDetail(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.88rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Full Name</span>
                  <strong>{selectedUserDetail.full_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Email Address</span>
                  <strong>{selectedUserDetail.email}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Campus</span>
                  <span>{selectedUserDetail.campus}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Department</span>
                  <span>{selectedUserDetail.department || 'None'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Role</span>
                  <span className="admin-badge admin-badge--active">{selectedUserDetail.role}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Account Status</span>
                  <span>{selectedUserDetail.is_active ? 'Active' : 'Suspended'}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-hair)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  Activity Statistics
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--amber)', display: 'block' }}>
                      {selectedUserDetail.lost_items_count}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lost Reports</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--cyan)', display: 'block' }}>
                      {selectedUserDetail.found_items_count}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Found Reports</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--violet)', display: 'block' }}>
                      {selectedUserDetail.claims_count}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Claims Made</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated-2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#22c55e', display: 'block' }}>
                      {selectedUserDetail.recoveries_count}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recoveries</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button onClick={() => setSelectedUserDetail(null)} className="admin-btn admin-btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role / Status Modal */}
      {editModalUser && (
        <div className="admin-modal-overlay" onClick={() => setEditModalUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveUserUpdate}>
              <div className="admin-modal-header">
                <h3>Edit User Privileges</h3>
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Modifying account privileges for <strong>{editModalUser.full_name}</strong> ({editModalUser.email}).
                </p>

                {modalError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Assigned Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="admin-select"
                    disabled={updating}
                  >
                    <option value="student">Student</option>
                    <option value="contributor">Contributor</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Account Status</label>
                  <select
                    value={newStatus ? 'true' : 'false'}
                    onChange={(e) => setNewStatus(e.target.value === 'true')}
                    className="admin-select"
                    disabled={updating}
                  >
                    <option value="true">Active (Permit Access)</option>
                    <option value="false">Suspended (Block Sign In)</option>
                  </select>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  className="admin-btn admin-btn-secondary"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={updating}>
                  {updating ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
