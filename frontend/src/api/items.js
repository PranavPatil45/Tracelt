// API service layer for unified Tracelt Item Details feature.
// Communicates with FastAPI backend:
// - GET /api/items/{item_type}/{item_id}
// - GET /api/lost-items/{id}
// - GET /api/found-items/{id}
// - PUT /api/lost-items/{id} & PUT /api/found-items/{id}
// - DELETE /api/lost-items/{id} & DELETE /api/found-items/{id}

import { updateLostItem, deleteLostItem, getLostItemById } from './lostItems.js'
import { updateFoundItem, deleteFoundItem, getFoundItemById } from './foundItems.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ItemApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'ItemApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Fetch unified item details by type ('lost' | 'found') and ID.
 * Returns normalized shape:
 * { id, type, title, category, description, location, campus, date, time, image_url, status, user_id, created_at, updated_at }
 *
 * @param {'lost'|'found'|'LOST'|'FOUND'} type
 * @param {number|string} id
 * @param {string} [token]
 * @returns {Promise<object>} Normalized item object
 */
export async function getItemDetails(type, id, token) {
  const normType = (type || '').toLowerCase().trim()
  const cleanId = String(id).trim()

  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // 1. First try the unified endpoint if valid type is provided
  if (normType === 'lost' || normType === 'found') {
    try {
      const response = await fetch(`${API_BASE_URL}/items/${normType}/${cleanId}`, {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        return await response.json()
      }

      if (response.status === 404) {
        throw new ItemApiError(
          `${normType === 'lost' ? 'Lost' : 'Found'} item report #${cleanId} could not be found.`,
          404
        )
      }

      if (response.status === 401) {
        throw new ItemApiError('Your session has expired. Please log in again.', 401)
      }

      const errData = await response.json().catch(() => null)
      throw new ItemApiError(errData?.detail || 'Failed to load item report.', response.status, errData)
    } catch (err) {
      if (err instanceof ItemApiError) {
        if (err.status === 404 || err.status === 401) throw err
      }
      // Fallback to specific endpoints below
    }
  }

  // 2. Fallback to specific endpoints if unified was unavailable or type was ambiguous
  if (normType === 'lost' || !normType) {
    try {
      const lostItem = await getLostItemById(cleanId, token)
      return {
        id: lostItem.id,
        type: 'LOST',
        title: lostItem.title,
        category: lostItem.category,
        description: lostItem.description,
        location: lostItem.location,
        campus: lostItem.campus,
        date: lostItem.lost_date,
        time: lostItem.lost_time,
        image_url: lostItem.image_url,
        status: lostItem.status,
        created_at: lostItem.created_at,
        updated_at: lostItem.updated_at,
        user_id: lostItem.user_id,
      }
    } catch (err) {
      if (normType === 'lost') throw err
    }
  }

  if (normType === 'found' || !normType) {
    try {
      const foundItem = await getFoundItemById(cleanId, token)
      return {
        id: foundItem.id,
        type: 'FOUND',
        title: foundItem.title,
        category: foundItem.category,
        description: foundItem.description,
        location: foundItem.location,
        campus: foundItem.campus,
        date: foundItem.found_date,
        time: foundItem.found_time,
        image_url: foundItem.image_url,
        status: foundItem.status,
        created_at: foundItem.created_at,
        updated_at: foundItem.updated_at,
        user_id: foundItem.user_id,
      }
    } catch (err) {
      throw err
    }
  }

  throw new ItemApiError('Item report could not be found.', 404)
}

/**
 * Update an item report (owner only).
 *
 * @param {'lost'|'found'|'LOST'|'FOUND'} type
 * @param {number|string} id
 * @param {object} updateData
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function updateItemDetails(type, id, updateData, token) {
  const normType = (type || '').toLowerCase().trim()
  if (normType === 'lost') {
    return await updateLostItem(id, updateData, token)
  } else if (normType === 'found') {
    return await updateFoundItem(id, updateData, token)
  }
  throw new ItemApiError(`Cannot update unknown item type: ${type}`, 400)
}

/**
 * Delete an item report (owner only).
 *
 * @param {'lost'|'found'|'LOST'|'FOUND'} type
 * @param {number|string} id
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function deleteItemDetails(type, id, token) {
  const normType = (type || '').toLowerCase().trim()
  if (normType === 'lost') {
    return await deleteLostItem(id, token)
  } else if (normType === 'found') {
    return await deleteFoundItem(id, token)
  }
  throw new ItemApiError(`Cannot delete unknown item type: ${type}`, 400)
}
