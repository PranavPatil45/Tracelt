// API service layer for Tracelt Lost Items feature.
// Communicates with FastAPI backend (/api/lost-items, /api/upload-image, etc.)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class LostItemApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'LostItemApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Upload an item photo to the backend server.
 *
 * @param {File} file - Image file (JPG/PNG/WEBP up to 5MB)
 * @param {string} token - JWT bearer token
 * @returns {Promise<{ image_url: string, filename: string }>}
 */
export async function uploadItemImage(file, token) {
  const formData = new FormData()
  formData.append('file', file)

  let response
  try {
    response = await fetch(`${API_BASE_URL}/upload-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  } catch {
    throw new LostItemApiError(
      'Unable to connect to the server to upload your image. Please check your internet connection and try again.',
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
    const errorMsg =
      data?.detail ||
      (response.status === 413
        ? 'The selected image is larger than 5MB. Please choose a smaller file.'
        : 'Failed to upload the image. Please verify it is a valid JPG, PNG, or WEBP.')
    throw new LostItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Report a new lost item.
 *
 * @param {object} itemData - Item form payload (title, category, description, location, lost_date, lost_time, image_url)
 * @param {string} token - JWT bearer token
 * @returns {Promise<object>} Created lost item record
 */
export async function reportLostItem(itemData, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/lost-items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    })
  } catch {
    throw new LostItemApiError(
      'Unable to submit your report. Please check your connection and try again.',
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
    let errorMsg = 'Failed to submit report. Please review your input and try again.'
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d) => d.msg || d.detail).join('; ')
      } else {
        errorMsg = data.detail
      }
    } else if (response.status === 401) {
      errorMsg = 'Your session has expired. Please log in again.'
    }
    throw new LostItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Retrieve lost items reported by the currently authenticated user.
 *
 * @param {string} token - JWT bearer token
 * @returns {Promise<Array>} List of lost item objects
 */
export async function getMyLostItems(token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/users/me/lost-items`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new LostItemApiError(
      'Unable to load your reports right now. Check your connection and try again.',
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
    const errorMsg = data?.detail || 'Failed to fetch your reports.'
    throw new LostItemApiError(errorMsg, response.status, data)
  }

  return Array.isArray(data) ? data : []
}

/**
 * Retrieve single lost item details by ID.
 *
 * @param {number|string} id - Lost item ID
 * @param {string} [token] - Optional JWT token
 * @returns {Promise<object>} Item details
 */
export async function getLostItemById(id, token) {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}/lost-items/${id}`, {
      method: 'GET',
      headers,
    })
  } catch {
    throw new LostItemApiError(
      'Unable to load item details. Please check your connection.',
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
    const errorMsg = data?.detail || (response.status === 404 ? 'Lost item not found.' : 'Failed to load item.')
    throw new LostItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Update a lost item report (owner only).
 *
 * @param {number|string} id - Lost item ID
 * @param {object} updateData - Partial update payload
 * @param {string} token - JWT bearer token
 * @returns {Promise<object>} Updated lost item
 */
export async function updateLostItem(id, updateData, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/lost-items/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    })
  } catch {
    throw new LostItemApiError(
      'Unable to update report. Check your connection and try again.',
      0
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON
  }

  if (!response.ok) {
    const errorMsg =
      data?.detail ||
      (response.status === 403
        ? 'You do not have permission to modify this report.'
        : 'Failed to update report.')
    throw new LostItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Delete a lost item report (owner only).
 *
 * @param {number|string} id - Lost item ID
 * @param {string} token - JWT bearer token
 * @returns {Promise<{ message: string, id: number }>}
 */
export async function deleteLostItem(id, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/lost-items/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new LostItemApiError(
      'Unable to delete report. Check your connection and try again.',
      0
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON
  }

  if (!response.ok) {
    const errorMsg =
      data?.detail ||
      (response.status === 403
        ? 'You do not have permission to delete this report.'
        : 'Failed to delete report.')
    throw new LostItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * List public lost items with optional filters.
 *
 * @param {object} [params] - Filter parameters
 * @returns {Promise<Array>}
 */
export async function getPublicLostItems(params = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val)
    }
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}/lost-items?${query.toString()}`)
  } catch {
    throw new LostItemApiError('Unable to load lost items directory.', 0)
  }

  if (!response.ok) {
    throw new LostItemApiError('Failed to load items.', response.status)
  }

  return await response.json()
}
