// Utility for resolving browser-accessible URLs for item images across Tracelt

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * Derives the backend base host URL if VITE_API_BASE_URL is an absolute URL (e.g., http://localhost:8000/api).
 * If VITE_API_BASE_URL is relative (e.g., /api), returns empty string so relative paths are resolved against current host/proxy.
 */
function getBackendOrigin() {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    try {
      const u = new URL(API_BASE_URL)
      return u.origin
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * Returns a reliable, browser-accessible image URL.
 *
 * @param {string|null|undefined} rawUrl - The stored image URL or relative path
 * @returns {string|null} - The fully resolved URL, or null if no valid image path is provided
 */
export function getItemImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null
  }

  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return null
  }

  // Already a blob or data URL (e.g. preview)
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed
  }

  // Already an absolute HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  const origin = getBackendOrigin()

  // Standard backend /uploads path
  if (trimmed.startsWith('/uploads/')) {
    return origin ? `${origin}${trimmed}` : trimmed
  }

  // If backend returned /api/uploads path
  if (trimmed.startsWith('/api/uploads/')) {
    return origin ? `${origin}${trimmed}` : trimmed
  }

  // Relative path without leading slash
  if (trimmed.startsWith('uploads/')) {
    return origin ? `${origin}/${trimmed}` : `/${trimmed}`
  }

  // Just a filename (e.g. "abc12345.jpg")
  return origin ? `${origin}/uploads/${trimmed}` : `/uploads/${trimmed}`
}
