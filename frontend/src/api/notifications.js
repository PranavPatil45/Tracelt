const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

/**
 * Fetch paginated notifications for authenticated user
 */
export async function getNotifications({ page = 1, limit = 20, filter } = {}, token) {
  const query = new URLSearchParams()
  query.append('page', String(page))
  query.append('limit', String(limit))
  if (filter && filter !== 'all') {
    query.append('filter', filter)
  }

  const res = await fetch(`${API_BASE_URL}/notifications?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch notifications.')
  }

  return await res.json()
}

/**
 * Fetch unread notifications count for bell badge
 */
export async function getUnreadCount(token) {
  const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch unread count.')
  }

  const data = await res.json()
  return data.count || 0
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId, token) {
  const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to mark notification as read.')
  }

  return await res.json()
}

/**
 * Mark all unread notifications as read for current user
 */
export async function markAllAsRead(token) {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to mark all notifications as read.')
  }

  return await res.json()
}

/**
 * Delete a single notification (owner only)
 */
export async function deleteNotification(notificationId, token) {
  const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to delete notification.')
  }

  return await res.json()
}

/**
 * Centralized router mapping for actionable notifications
 */
export function getNotificationRoute(notification) {
  if (!notification) return '/dashboard'

  switch (notification.type) {
    case 'MATCH_FOUND':
      return '/matches'
    case 'CLAIM_SUBMITTED':
    case 'CLAIM_APPROVED':
    case 'CLAIM_REJECTED':
    case 'CLAIM_CANCELLED':
      return '/claims'
    case 'MESSAGE_RECEIVED':
      if (notification.metadata?.conversation_id) {
        return `/messages?conversation_id=${notification.metadata.conversation_id}`
      }
      return '/messages'
    case 'ITEM_RETURNED':
    case 'ITEM_RECOVERED':
      if (notification.metadata?.recovery_id) {
        return `/recovery/${notification.metadata.recovery_id}`
      }
      return '/history'
    default:
      return '/dashboard'
  }
}

export { formatRelativeTime, formatTimeAgo } from '../utils/dateUtils.js'

