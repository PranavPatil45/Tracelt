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

export async function fetchReviewerStats(token) {
  const res = await fetch(`${API_BASE_URL}/reviewer/stats`, {
    headers: getAuthHeaders(token),
  })
  return handleResponse(res)
}

export async function fetchReviewerCases(
  token,
  { case_type = 'ALL', status = 'ALL', search, page = 1, limit = 20 } = {}
) {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/reviewer/cases`)
  if (case_type && case_type !== 'ALL') url.searchParams.set('case_type', case_type)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  if (search) url.searchParams.set('search', search)
  url.searchParams.set('page', page)
  url.searchParams.set('limit', limit)

  const res = await fetch(url.toString(), { headers: getAuthHeaders(token) })
  return handleResponse(res)
}

export async function fetchReviewerCaseDetail(token, caseType, caseId) {
  const res = await fetch(`${API_BASE_URL}/reviewer/cases/${caseType}/${caseId}`, {
    headers: getAuthHeaders(token),
  })
  return handleResponse(res)
}

export async function startReviewOnCase(token, caseType, caseId) {
  const res = await fetch(`${API_BASE_URL}/reviewer/cases/${caseType}/${caseId}/start-review`, {
    method: 'POST',
    headers: getAuthHeaders(token),
  })
  return handleResponse(res)
}

export async function decideReviewerCase(token, caseType, caseId, { action, rationale, handover_method }) {
  const res = await fetch(`${API_BASE_URL}/reviewer/cases/${caseType}/${caseId}/decide`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({
      action,
      rationale,
      handover_method: handover_method || undefined,
    }),
  })
  return handleResponse(res)
}

export async function returnReviewerCase(token, caseType, caseId, { reason }) {
  const res = await fetch(`${API_BASE_URL}/reviewer/cases/${caseType}/${caseId}/return-reassign`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ reason }),
  })
  return handleResponse(res)
}
