// API service layer for Tracelt Claim & Verification System.
// Communicates with FastAPI backend (/api/matches/{id}/claim, /api/claims, /api/claims/incoming, etc.)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ClaimApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'ClaimApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Submit an ownership claim for a matched item.
 *
 * @param {number|string} matchId
 * @param {object} payload
 * @param {string} payload.verification_details
 * @param {string} [payload.additional_message]
 * @param {string} token
 * @returns {Promise<object>} Created Claim
 */
export async function submitClaim(matchId, payload, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/matches/${matchId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ClaimApiError('Unable to connect to claim service. Please check your connection.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON
  }

  if (!response.ok) {
    let errorMsg = 'Failed to submit claim request.'
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d) => d.msg || d.detail).join('; ')
      } else {
        errorMsg = data.detail
      }
    }
    throw new ClaimApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Fetch claims submitted by the current user (Claimant view).
 *
 * @param {object} [filters]
 * @param {string} [filters.status='all']
 * @param {number} [filters.skip=0]
 * @param {number} [filters.limit=50]
 * @param {string} token
 * @returns {Promise<{ claims: Array, total: number }>}
 */
export async function getMyClaims(filters = {}, token) {
  const query = new URLSearchParams()
  if (filters.status && filters.status !== 'all') query.append('status', filters.status)
  if (filters.skip !== undefined) query.append('skip', filters.skip)
  if (filters.limit !== undefined) query.append('limit', filters.limit)

  const url = `${API_BASE_URL}/claims${query.toString() ? `?${query.toString()}` : ''}`
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(url, { method: 'GET', headers })
  } catch {
    throw new ClaimApiError('Unable to load your claims. Check your connection.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON
  }

  if (!response.ok) {
    throw new ClaimApiError(data?.detail || 'Failed to load claims.', response.status, data)
  }

  return {
    claims: Array.isArray(data?.claims) ? data.claims : [],
    total: typeof data?.total === 'number' ? data.total : 0,
  }
}

/**
 * Fetch incoming claims submitted on items found by this user (Finder review view).
 *
 * @param {object} [filters]
 * @param {string} [filters.status='all']
 * @param {number} [filters.skip=0]
 * @param {number} [filters.limit=50]
 * @param {string} token
 * @returns {Promise<{ claims: Array, total: number }>}
 */
export async function getIncomingClaims(filters = {}, token) {
  const query = new URLSearchParams()
  if (filters.status && filters.status !== 'all') query.append('status', filters.status)
  if (filters.skip !== undefined) query.append('skip', filters.skip)
  if (filters.limit !== undefined) query.append('limit', filters.limit)

  const url = `${API_BASE_URL}/claims/incoming${query.toString() ? `?${query.toString()}` : ''}`
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(url, { method: 'GET', headers })
  } catch {
    throw new ClaimApiError('Unable to load incoming claims. Check your connection.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON
  }

  if (!response.ok) {
    throw new ClaimApiError(data?.detail || 'Failed to load claims to review.', response.status, data)
  }

  return {
    claims: Array.isArray(data?.claims) ? data.claims : [],
    total: typeof data?.total === 'number' ? data.total : 0,
  }
}

/**
 * Retrieve single claim by ID.
 *
 * @param {number|string} claimId
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getClaimById(claimId, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}/claims/${claimId}`, {
      method: 'GET',
      headers,
    })
  } catch {
    throw new ClaimApiError('Unable to load claim details.', 0)
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ClaimApiError(data?.detail || 'Failed to load claim.', response.status, data)
  }

  return await response.json()
}

/**
 * Review claim (Finder action: APPROVE, REJECT, or UNDER_REVIEW).
 *
 * @param {number|string} claimId
 * @param {object} payload
 * @param {'APPROVE'|'REJECT'|'UNDER_REVIEW'} payload.action
 * @param {string} [payload.reviewer_notes]
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function reviewClaim(claimId, payload, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/claims/${claimId}/review`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ClaimApiError('Unable to review claim. Check your connection.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON
  }

  if (!response.ok) {
    throw new ClaimApiError(data?.detail || 'Failed to submit review.', response.status, data)
  }

  return data
}

/**
 * Cancel a pending claim (Claimant action).
 *
 * @param {number|string} claimId
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function cancelClaim(claimId, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/claims/${claimId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new ClaimApiError('Unable to cancel claim.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON
  }

  if (!response.ok) {
    throw new ClaimApiError(data?.detail || 'Failed to cancel claim.', response.status, data)
  }

  return data
}

/**
 * Check if an active claim already exists on a given match.
 *
 * @param {number|string} matchId
 * @param {string} token
 * @returns {Promise<{ has_active_claim: boolean, claim: object|null }>}
 */
export async function getActiveClaimForMatch(matchId, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/active-claim`, {
      method: 'GET',
      headers,
    })
    if (response.ok) {
      return await response.json()
    }
  } catch {
    // Non-blocking fallback
  }

  return { has_active_claim: false, claim: null }
}
