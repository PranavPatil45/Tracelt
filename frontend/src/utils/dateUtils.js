/**
 * Tracelt Centralized Date & Time Utilities
 * Handles UTC database timestamp parsing, localized relative times, and formatted dates.
 */

/**
 * Safely parse any date string or object into a valid Date object.
 * Normalizes UTC strings from SQLite/FastAPI (which may lack the 'Z' suffix).
 */
export function parseDate(dateInput) {
  if (!dateInput) return null

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput
  }

  if (typeof dateInput === 'number') {
    const d = new Date(dateInput)
    return isNaN(d.getTime()) ? null : d
  }

  if (typeof dateInput === 'string') {
    let cleanStr = dateInput.trim()
    if (!cleanStr) return null

    // If it's a date-only string like YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const [year, month, day] = cleanStr.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      return isNaN(d.getTime()) ? null : d
    }

    // If it's an ISO-like timestamp without timezone offset, treat as UTC
    if (!cleanStr.includes('Z') && !cleanStr.includes('+') && !cleanStr.includes('-', 10)) {
      cleanStr = cleanStr.replace(' ', 'T') + 'Z'
    } else if (cleanStr.includes(' ') && !cleanStr.includes('T')) {
      cleanStr = cleanStr.replace(' ', 'T')
    }

    const d = new Date(cleanStr)
    return isNaN(d.getTime()) ? null : d
  }

  return null
}

/**
 * Formats a timestamp into human-friendly relative time:
 * - < 1 min: "Just now"
 * - 1–59 min: "1 minute ago" or "${n} minutes ago"
 * - 1–23 hours: "1 hour ago" or "${n} hours ago"
 * - 1–6 days: "Yesterday" or "${n} days ago"
 * - 7+ days: "18 Sep 2026"
 */
export function formatRelativeTime(dateInput) {
  const date = parseDate(dateInput)
  if (!date) return ''

  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  // Clock skew tolerance
  if (diffInSeconds < 60) {
    return 'Just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return diffInDays === 1 ? 'Yesterday' : `${diffInDays} days ago`
  }

  // 7 days or more -> e.g. "18 Sep 2026"
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Alias for backward compatibility
 */
export const formatTimeAgo = formatRelativeTime

/**
 * Formats date-only strings or timestamps into e.g. "18 Sep 2026"
 */
export function formatDate(dateInput) {
  const date = parseDate(dateInput)
  if (!date) return 'Not specified'

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Formats date and time into e.g. "18 Sep 2026 · 10:42 AM"
 */
export function formatDateTime(dateInput) {
  const date = parseDate(dateInput)
  if (!date) return 'Not specified'

  const datePart = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const timePart = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${datePart} · ${timePart}`
}
