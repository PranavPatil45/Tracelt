const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse(response) {
  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`
    try {
      const data = await response.json()
      if (data?.detail) {
        errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
      }
    } catch {}
    const err = new Error(errorMsg)
    err.status = response.status
    throw err
  }
  return response.json()
}

// --- Statistics ---
export async function fetchAdminStats(token, campus) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/stats`)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

// --- Activity Feed ---
export async function fetchAdminActivity(token, { page = 1, limit = 20, campus } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/activity`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

// --- User Management ---
export async function fetchAdminUsers(token, { search, role, campus, isActive, page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/users`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (search) url.searchParams.set('search', search)
  if (role && role !== 'ALL') url.searchParams.set('role', role)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  if (isActive !== undefined && isActive !== 'ALL') url.searchParams.set('is_active', isActive)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

export async function fetchAdminUserDetail(token, userId) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

export async function updateAdminUser(token, userId, data) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

// --- Item Moderation ---
export async function fetchAdminLostItems(token, { search, category, status, campus, page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/lost-items`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (search) url.searchParams.set('search', search)
  if (category && category !== 'ALL') url.searchParams.set('category', category)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

export async function fetchAdminFoundItems(token, { search, category, status, campus, page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/found-items`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (search) url.searchParams.set('search', search)
  if (category && category !== 'ALL') url.searchParams.set('category', category)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

export async function updateAdminItemStatus(token, itemType, itemId, { status, reason }) {
  const res = await fetch(`${API_BASE_URL}/admin/items/${itemType}/${itemId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ status, reason }),
  })
  return handleResponse(res)
}

// --- Matches ---
export async function fetchAdminMatches(token, { status, campus, page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/matches`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

// --- Claims ---
export async function fetchAdminClaims(token, { status, campus, page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/claims`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

export async function reviewAdminClaim(token, claimId, { action, reviewer_notes }) {
  const res = await fetch(`${API_BASE_URL}/admin/claims/${claimId}/review`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ action, reviewer_notes }),
  })
  return handleResponse(res)
}

// --- Recoveries ---
export async function fetchAdminRecoveries(token, { status, campus, page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/recoveries`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  if (campus && campus !== 'ALL') url.searchParams.set('campus', campus)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

// --- Moderation Reports ---
export async function fetchAdminReports(token, { status, page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/reports`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

export async function createAdminReport(token, data) {
  const res = await fetch(`${API_BASE_URL}/admin/reports`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function updateAdminReport(token, reportId, { status, admin_notes }) {
  const res = await fetch(`${API_BASE_URL}/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ status, admin_notes }),
  })
  return handleResponse(res)
}

// --- Audit Logs ---
export async function fetchAdminAuditLogs(token, { page = 1, limit = 20 } = {}) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/admin/audit-logs`)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)
  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}
