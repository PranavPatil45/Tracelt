// API service layer for Tracelt Recovery & History System.
// Communicates with FastAPI backend (/api/recoveries, /api/claims/{claim_id}/recovery, /api/history, /api/history/stats)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class RecoveryApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'RecoveryApiError'
    this.status = status
    this.detail = detail
  }
}

async function handleResponse(response, defaultErrorMsg) {
  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    let errorMsg = defaultErrorMsg
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d) => d.msg || d.detail).join('; ')
      } else {
        errorMsg = data.detail
      }
    }
    throw new RecoveryApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Fetch recovery record by ID.
 *
 * @param {number|string} recoveryId
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getRecovery(recoveryId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/recoveries/${recoveryId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return await handleResponse(response, 'Failed to fetch recovery details.')
  } catch (err) {
    if (err instanceof RecoveryApiError) throw err
    throw new RecoveryApiError('Unable to connect to recovery service.', 0)
  }
}

/**
 * Fetch recovery record associated with a claim ID.
 *
 * @param {number|string} claimId
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getClaimRecovery(claimId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/claims/${claimId}/recovery`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return await handleResponse(response, 'Failed to find recovery record for this claim.')
  } catch (err) {
    if (err instanceof RecoveryApiError) throw err
    throw new RecoveryApiError('Unable to connect to recovery service.', 0)
  }
}

/**
 * Mark item as returned / handed over (Finder action).
 *
 * @param {number|string} recoveryId
 * @param {object} payload
 * @param {string} payload.return_location
 * @param {string} [payload.return_notes]
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function markReturned(recoveryId, payload, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/recoveries/${recoveryId}/returned`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return await handleResponse(response, 'Failed to mark item as returned.')
  } catch (err) {
    if (err instanceof RecoveryApiError) throw err
    throw new RecoveryApiError('Unable to connect to recovery service.', 0)
  }
}

/**
 * Confirm receipt of item (Claimant action).
 *
 * @param {number|string} recoveryId
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function confirmRecovery(recoveryId, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/recoveries/${recoveryId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return await handleResponse(response, 'Failed to confirm item recovery.')
  } catch (err) {
    if (err instanceof RecoveryApiError) throw err
    throw new RecoveryApiError('Unable to connect to recovery service.', 0)
  }
}

/**
 * Fetch user's history of recovered and returned items.
 *
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.status]
 * @param {string} [params.role]
 * @param {string} [params.type]
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getHistory(params = {}, token) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page)
  if (params.limit) query.set('limit', params.limit)
  if (params.status && params.status !== 'all') query.set('status', params.status)
  if (params.role && params.role !== 'all') query.set('role', params.role)
  if (params.type && params.type !== 'all') query.set('role', params.type)

  const qs = query.toString() ? `?${query.toString()}` : ''

  try {
    const response = await fetch(`${API_BASE_URL}/history${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return await handleResponse(response, 'Failed to fetch user history.')
  } catch (err) {
    if (err instanceof RecoveryApiError) throw err
    throw new RecoveryApiError('Unable to connect to history service.', 0)
  }
}

/**
 * Fetch user's recovery and return statistics.
 *
 * @param {string} token
 * @returns {Promise<{recovered_count: number, returned_count: number, pending_action_count: number}>}
 */
export async function getHistoryStats(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/history/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return await handleResponse(response, 'Failed to fetch recovery stats.')
  } catch (err) {
    if (err instanceof RecoveryApiError) throw err
    throw new RecoveryApiError('Unable to connect to history service.', 0)
  }
}
