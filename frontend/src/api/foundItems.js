// API service layer for Tracelt Found Items feature.
// Communicates with FastAPI backend (/api/found-items, /api/upload-image, etc.)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class FoundItemApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'FoundItemApiError'
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
    throw new FoundItemApiError(
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
    throw new FoundItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Report a new found item.
 *
 * @param {object} itemData - Item form payload (title, category, description, location, found_date, found_time, image_url)
 * @param {string} token - JWT bearer token
 * @returns {Promise<object>} Created found item record
 */
export async function reportFoundItem(itemData, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/found-items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    })
  } catch {
    throw new FoundItemApiError(
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
    throw new FoundItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Retrieve found items reported by the currently authenticated user.
 *
 * @param {string} token - JWT bearer token
 * @returns {Promise<Array>} List of found item objects
 */
export async function getMyFoundItems(token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/users/me/found-items`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new FoundItemApiError(
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
    throw new FoundItemApiError(errorMsg, response.status, data)
  }

  return Array.isArray(data) ? data : []
}

/**
 * Retrieve single found item details by ID.
 *
 * @param {number|string} id - Found item ID
 * @param {string} [token] - Optional JWT token
 * @returns {Promise<object>} Item details
 */
export async function getFoundItemById(id, token) {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}/found-items/${id}`, {
      method: 'GET',
      headers,
    })
  } catch {
    throw new FoundItemApiError(
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
    const errorMsg = data?.detail || (response.status === 404 ? 'Found item not found.' : 'Failed to load item.')
    throw new FoundItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Update a found item report (owner only).
 *
 * @param {number|string} id - Found item ID
 * @param {object} updateData - Partial update payload
 * @param {string} token - JWT bearer token
 * @returns {Promise<object>} Updated found item
 */
export async function updateFoundItem(id, updateData, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/found-items/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    })
  } catch {
    throw new FoundItemApiError(
      'Unable to update the item report. Please check your connection.',
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
    let errorMsg = 'Failed to update item report.'
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d) => d.msg || d.detail).join('; ')
      } else {
        errorMsg = data.detail
      }
    } else if (response.status === 403) {
      errorMsg = 'You do not have permission to modify this report.'
    }
    throw new FoundItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Delete a found item report (owner only).
 *
 * @param {number|string} id - Found item ID
 * @param {string} token - JWT bearer token
 * @returns {Promise<{ message: string, id: number }>}
 */
export async function deleteFoundItem(id, token) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/found-items/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new FoundItemApiError(
      'Unable to delete the item report. Please check your connection.',
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
      (response.status === 403
        ? 'You do not have permission to delete this report.'
        : 'Failed to delete item report.')
    throw new FoundItemApiError(errorMsg, response.status, data)
  }

  return data
}

/**
 * Fetch all public found items with optional filters.
 *
 * @param {object} [filters]
 * @returns {Promise<Array>}
 */
export async function getAllFoundItems(filters = {}) {
  const query = new URLSearchParams()
  if (filters.category) query.append('category', filters.category)
  if (filters.location) query.append('location', filters.location)
  if (filters.status) query.append('status', filters.status)
  if (filters.campus) query.append('campus', filters.campus)
  if (filters.search) query.append('search', filters.search)
  if (filters.skip !== undefined) query.append('skip', filters.skip)
  if (filters.limit !== undefined) query.append('limit', filters.limit)

  const url = `${API_BASE_URL}/found-items${query.toString() ? `?${query.toString()}` : ''}`
  let response
  try {
    response = await fetch(url)
  } catch {
    throw new FoundItemApiError('Failed to connect to Tracelt catalog.', 0)
  }

  if (!response.ok) {
    throw new FoundItemApiError('Could not load found items.', response.status)
  }

  return await response.json()
}
