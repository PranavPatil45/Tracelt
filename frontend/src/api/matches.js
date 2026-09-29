// API service layer for Tracelt Matching System.
// Communicates with FastAPI backend (/api/matches, /api/lost-items/{id}/matches, etc.)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class MatchApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'MatchApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Fetch matches relevant to the authenticated user with optional filtering.
 *
 * @param {object} [filters]
 * @param {'all'|'lost'|'found'} [filters.type='all']
 * @param {'all'|'POSSIBLE'|'REVIEWED'|'REJECTED'} [filters.status='all']
 * @param {number} [filters.min_score=60]
 * @param {number} [filters.skip=0]
 * @param {number} [filters.limit=50]
 * @param {string} token - JWT bearer token
 * @returns {Promise<{ matches: Array, total: number }>}
 */
export async function getMatches(filters = {}, token) {
  const query = new URLSearchParams()
  if (filters.type && filters.type !== 'all') query.append('type', filters.type)
  if (filters.status && filters.status !== 'all') query.append('status', filters.status)
  if (filters.min_score !== undefined) query.append('min_score', filters.min_score)
  if (filters.skip !== undefined) query.append('skip', filters.skip)
  if (filters.limit !== undefined) query.append('limit', filters.limit)

  const url = `${API_BASE_URL}/matches${query.toString() ? `?${query.toString()}` : ''}`
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(url, { method: 'GET', headers })
  } catch {
    throw new MatchApiError(
      'Unable to connect to the matching service. Please check your internet connection and try again.',
      0
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const errorMsg = data?.detail || (response.status === 401 ? 'Session expired.' : 'Failed to fetch matches.')
    throw new MatchApiError(errorMsg, response.status, data)
  }

  return {
    matches: Array.isArray(data?.matches) ? data.matches : [],
    total: typeof data?.total === 'number' ? data.total : 0,
  }
}

/**
 * Fetch matches for a specific Lost Item report.
 *
 * @param {number|string} lostItemId
 * @param {string} token
 * @returns {Promise<Array>}
 */
export async function getLostItemMatches(lostItemId, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}/lost-items/${lostItemId}/matches`, {
      method: 'GET',
      headers,
    })
  } catch {
    throw new MatchApiError('Unable to load matches for this lost item.', 0)
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => null)
    throw new MatchApiError(errData?.detail || 'Failed to load matches.', response.status, errData)
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

/**
 * Fetch matches for a specific Found Item report.
 *
 * @param {number|string} foundItemId
 * @param {string} token
 * @returns {Promise<Array>}
 */
export async function getFoundItemMatches(foundItemId, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}/found-items/${foundItemId}/matches`, {
      method: 'GET',
      headers,
    })
  } catch {
    throw new MatchApiError('Unable to load matches for this found item.', 0)
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => null)
    throw new MatchApiError(errData?.detail || 'Failed to load matches.', response.status, errData)
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

/**
 * Fetch a single match details by ID.
 *
 * @param {number|string} matchId
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getMatchById(matchId, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}/matches/${matchId}`, {
      method: 'GET',
      headers,
    })
  } catch {
    throw new MatchApiError('Unable to load match details.', 0)
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => null)
    throw new MatchApiError(errData?.detail || 'Failed to load match.', response.status, errData)
  }

  return await response.json()
}

/**
 * Update match status (REVIEWED, REJECTED, POSSIBLE).
 *
 * @param {number|string} matchId
 * @param {'REVIEWED'|'REJECTED'|'POSSIBLE'} status
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function updateMatchStatus(matchId, status, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/matches/${matchId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    })
  } catch {
    throw new MatchApiError('Unable to update match status.', 0)
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => null)
    throw new MatchApiError(errData?.detail || 'Failed to update match status.', response.status, errData)
  }

  return await response.json()
}

/**
 * Trigger an on-demand campus scan for new matches.
 *
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function triggerCampusScan(token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/matches/scan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new MatchApiError('Failed to trigger matching scan.', 0)
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => null)
    throw new MatchApiError(errData?.detail || 'Matching scan failed.', response.status, errData)
  }

  return await response.json()
}
