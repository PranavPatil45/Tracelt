// API service layer for Tracelt Explore & Search feature.
// Communicates with FastAPI endpoint: GET /api/explore

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ExploreApiError extends Error {
  constructor(message, status = 0, detail = null) {
    super(message)
    this.name = 'ExploreApiError'
    this.status = status
    this.detail = detail
  }
}

/**
 * Fetch unified lost and found items with search, filters, sorting, and pagination.
 *
 * @param {object} filters
 * @param {string} [filters.search] - Search keyword
 * @param {string} [filters.type] - "all" | "lost" | "found"
 * @param {string} [filters.category] - Item category
 * @param {string} [filters.location] - Campus location
 * @param {string} [filters.date_preset] - "all" | "today" | "7days" | "30days"
 * @param {string} [filters.date_from] - YYYY-MM-DD
 * @param {string} [filters.date_to] - YYYY-MM-DD
 * @param {string} [filters.status] - Item status
 * @param {string} [filters.sort] - "newest" | "oldest" | "date_newest" | "date_oldest"
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=12] - Items per page
 * @param {string} [filters.campus] - Campus name
 * @param {string} token - JWT authentication token
 * @returns {Promise<{ items: Array, total: number, page: number, limit: number, pages: number }>}
 */
export async function fetchExploreItems(filters = {}, token) {
  const query = new URLSearchParams()

  if (filters.search && filters.search.trim()) {
    query.append('search', filters.search.trim())
  }
  if (filters.type && filters.type !== 'all') {
    query.append('type', filters.type)
  }
  if (filters.category && filters.category !== 'all') {
    query.append('category', filters.category)
  }
  if (filters.location && filters.location !== 'all') {
    query.append('location', filters.location)
  }
  if (filters.date_preset && filters.date_preset !== 'all') {
    query.append('date_preset', filters.date_preset)
  }
  if (filters.date_from) {
    query.append('date_from', filters.date_from)
  }
  if (filters.date_to) {
    query.append('date_to', filters.date_to)
  }
  if (filters.status && filters.status !== 'all') {
    query.append('status', filters.status)
  }
  if (filters.sort) {
    query.append('sort', filters.sort)
  }
  if (filters.page) {
    query.append('page', filters.page)
  }
  if (filters.limit) {
    query.append('limit', filters.limit)
  }
  if (filters.campus) {
    query.append('campus', filters.campus)
  }

  const url = `${API_BASE_URL}/explore${query.toString() ? `?${query.toString()}` : ''}`

  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(url, { method: 'GET', headers })
  } catch {
    throw new ExploreApiError(
      'Unable to connect to the server. Please check your internet connection and try again.',
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
      (response.status === 401
        ? 'Your session has expired. Please log in again.'
        : 'Failed to fetch campus reports.')
    throw new ExploreApiError(errorMsg, response.status, data)
  }

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: typeof data?.total === 'number' ? data.total : 0,
    page: typeof data?.page === 'number' ? data.page : 1,
    limit: typeof data?.limit === 'number' ? data.limit : 12,
    pages: typeof data?.pages === 'number' ? data.pages : 1,
  }
}
