// Tracelt Dashboard API integration layer
// Connected directly to FastAPI / SQLAlchemy endpoints

import { formatRelativeTime, formatDate } from '../utils/dateUtils.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * Fetch overview statistics for the current authenticated user from database
 */
export async function fetchUserStats(token) {
  if (!token) {
    return {
      lostItems: 0,
      foundItems: 0,
      matches: 0,
      claims: 0,
      recovered: 0,
      unreadMessages: 0,
      unreadNotifications: 0,
      lost_items: 0,
      found_items: 0,
      unread_messages: 0,
      unread_notifications: 0,
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/users/me/dashboard-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      return {
        lostItems: data.lost_items ?? 0,
        foundItems: data.found_items ?? 0,
        matches: data.matches ?? 0,
        claims: data.claims ?? 0,
        recovered: data.recovered ?? 0,
        unreadMessages: data.unread_messages ?? 0,
        unreadNotifications: data.unread_notifications ?? 0,
        lost_items: data.lost_items ?? 0,
        found_items: data.found_items ?? 0,
        unread_messages: data.unread_messages ?? 0,
        unread_notifications: data.unread_notifications ?? 0,
      }
    }
  } catch (err) {
    console.error('Error fetching dashboard stats:', err)
  }

  // Graceful fallback querying individual endpoints
  try {
    const [lostRes, foundRes, historyRes] = await Promise.all([
      fetch(`${API_BASE_URL}/users/me/lost-items`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE_URL}/users/me/found-items`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE_URL}/history/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    const lostItems = lostRes.ok ? (await lostRes.json()).length : 0
    const foundItems = foundRes.ok ? (await foundRes.json()).length : 0
    let recovered = 0
    if (historyRes.ok) {
      const hStats = await historyRes.json()
      recovered = hStats.recovered_count || 0
    }

    return {
      lostItems,
      foundItems,
      matches: 0,
      claims: 0,
      recovered,
      unreadMessages: 0,
      unreadNotifications: 0,
      lost_items: lostItems,
      found_items: foundItems,
      unread_messages: 0,
      unread_notifications: 0,
    }
  } catch {
    return {
      lostItems: 0,
      foundItems: 0,
      matches: 0,
      claims: 0,
      recovered: 0,
      unreadMessages: 0,
      unreadNotifications: 0,
      lost_items: 0,
      found_items: 0,
      unread_messages: 0,
      unread_notifications: 0,
    }
  }
}

/**
 * Fetch ongoing active traces (lost item reports)
 * Filters out items that are already recovered, closed, or returned.
 */
export async function fetchActiveTraces(token) {
  if (!token) return []

  try {
    const res = await fetch(`${API_BASE_URL}/users/me/lost-items`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const realItems = await res.json()
      // Only include active lost reports that are still in progress
      const activeItems = realItems.filter(
        (item) =>
          item.status !== 'RECOVERED' &&
          item.status !== 'CLOSED' &&
          item.status !== 'RETURNED'
      )

      return activeItems.map((item) => ({
        id: `real-${item.id}`,
        rawId: item.id,
        title: item.title,
        category: item.category,
        lostLocation: item.location,
        reportedTime: item.lost_date ? formatDate(item.lost_date) : 'Recently',
        status: item.status === 'ACTIVE' ? 'Searching' : item.status,
        statusDetail: 'Scanning campus reports for algorithmic correlation',
        hasMatch: false,
        match: null,
        icon: item.image_url ? '📷' : '🎒',
      }))
    }
  } catch (err) {
    console.error('Error fetching active traces:', err)
  }

  return []
}

/**
 * Fetch possible match details
 */
export async function fetchPossibleMatch(token) {
  if (!token) return null

  try {
    const res = await fetch(`${API_BASE_URL}/matches?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      const topMatch = data.matches?.[0]
      if (topMatch) {
        return {
          id: topMatch.id,
          score: topMatch.score,
          status: topMatch.status,
          reasons: topMatch.reasons || [],
          signals: topMatch.signals,
          userReport: {
            id: topMatch.lost_item?.id,
            title: topMatch.lost_item?.title,
            category: topMatch.lost_item?.category,
            location: topMatch.lost_item?.location,
            date: topMatch.lost_item?.date ? formatDate(topMatch.lost_item.date) : 'Recently',
            time: topMatch.lost_item?.time || 'Time N/A',
            icon: '🎒',
          },
          matchedItem: {
            id: topMatch.found_item?.id,
            title: topMatch.found_item?.title,
            category: topMatch.found_item?.category,
            location: topMatch.found_item?.location,
            date: topMatch.found_item?.date ? formatDate(topMatch.found_item.date) : 'Recently',
            time: topMatch.found_item?.time || 'Time N/A',
            icon: '✨',
          },
          lost_item: topMatch.lost_item,
          found_item: topMatch.found_item,
        }
      }
    }
  } catch (err) {
    console.error('Error fetching possible match:', err)
  }

  return null
}

/**
 * Fetch campus activity feed scoped to the user's campus
 */
export async function fetchCampusActivity(token, campus) {
  if (!token) return []

  try {
    const url = campus && campus.trim()
      ? `${API_BASE_URL}/campus/activity?campus=${encodeURIComponent(campus.trim())}`
      : `${API_BASE_URL}/campus/activity`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const items = await res.json()
      return items.map((item) => ({
        ...item,
        timeAgo: item.created_at ? formatRelativeTime(item.created_at) : (item.timeAgo || 'Recently'),
      }))
    }
  } catch (err) {
    console.error('Error fetching campus activity:', err)
  }

  return []
}

/**
 * Fetch recent reports created or logged by the user (both lost and found)
 */
export async function fetchRecentReports(token) {
  if (!token) return []

  try {
    const [lostRes, foundRes] = await Promise.all([
      fetch(`${API_BASE_URL}/users/me/lost-items`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE_URL}/users/me/found-items`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    const reports = []

    if (lostRes.ok) {
      const lostItems = await lostRes.json()
      lostItems.forEach((item) => {
        reports.push({
          id: `lost-${item.id}`,
          item: item.title,
          icon: item.image_url ? '📷' : '🎒',
          type: 'Lost',
          location: item.location,
          date: item.lost_date ? formatDate(item.lost_date) : formatDate(item.created_at),
          status: item.status === 'ACTIVE' ? 'Searching' : item.status,
          statusColor: item.status === 'ACTIVE' ? 'amber' : (item.status === 'RECOVERED' || item.status === 'RETURNED' ? 'green' : 'cyan'),
          created_at: item.created_at,
        })
      })
    }

    if (foundRes.ok) {
      const foundItems = await foundRes.json()
      foundItems.forEach((item) => {
        reports.push({
          id: `found-${item.id}`,
          item: item.title,
          icon: item.image_url ? '📷' : '📦',
          type: 'Found',
          location: item.location,
          date: item.found_date ? formatDate(item.found_date) : formatDate(item.created_at),
          status: item.status === 'AVAILABLE' ? 'In Custody' : item.status,
          statusColor: item.status === 'AVAILABLE' ? 'cyan' : (item.status === 'RECOVERED' || item.status === 'RETURNED' ? 'green' : 'amber'),
          created_at: item.created_at,
        })
      })
    }

    // Sort newest first by created_at
    reports.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      return timeB - timeA
    })

    return reports.slice(0, 10)
  } catch (err) {
    console.error('Error fetching recent reports:', err)
    return []
  }
}

/**
 * Fetch user notifications
 */
export async function fetchNotifications(token) {
  if (!token) return []

  try {
    const res = await fetch(`${API_BASE_URL}/notifications?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      const items = data.notifications || []
      return items.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.message,
        time: formatRelativeTime(n.created_at),
        unread: !n.is_read,
        type: n.type?.includes('MATCH')
          ? 'match'
          : n.type?.includes('RECOVERED')
          ? 'recovery'
          : 'message',
        actionText: 'View',
        rawNotification: n,
      }))
    }
  } catch (err) {
    console.error('Error fetching notifications:', err)
  }

  return []
}

/**
 * Fetch successfully recovered / reconnected items
 */
export async function fetchReconnectedItems(token) {
  if (!token) return []

  try {
    const res = await fetch(`${API_BASE_URL}/users/me/reconnected`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      return await res.json()
    }
  } catch (err) {
    console.error('Error fetching reconnected items:', err)
  }

  return []
}

/**
 * Submit a new Lost or Found item report
 */
export async function submitReport(reportData, token) {
  if (token) {
    try {
      const res = await fetch(`${API_BASE_URL}/reports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      })
      if (res.ok) {
        window.dispatchEvent(new Event('tracelt:refresh-stats'))
        return await res.json()
      }
    } catch (err) {
      console.error('Error submitting report:', err)
    }
  }

  window.dispatchEvent(new Event('tracelt:refresh-stats'))
  return reportData
}

/**
 * Confirm a match recovery
 */
export async function confirmRecovery(match, token) {
  if (token) {
    try {
      const res = await fetch(`${API_BASE_URL}/matches/${match.id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        window.dispatchEvent(new Event('tracelt:refresh-stats'))
        return await res.json()
      }
    } catch (err) {
      console.error('Error confirming recovery:', err)
    }
  }

  window.dispatchEvent(new Event('tracelt:refresh-stats'))
  return null
}
