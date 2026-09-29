const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

/**
 * Fetch all conversations for the authenticated user
 */
export async function getConversations({ page = 1, limit = 50 } = {}, token) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  const res = await fetch(`${API_BASE_URL}/conversations?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to load conversations.')
  }

  return await res.json()
}

/**
 * Fetch single conversation detail including messages and item metadata
 */
export async function getConversation(conversationId, token) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to load conversation details.')
  }

  return await res.json()
}

/**
 * Get or create conversation for a specific claim
 */
export async function createConversationForClaim(claimId, token) {
  const res = await fetch(`${API_BASE_URL}/claims/${claimId}/conversation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to open conversation for this claim.')
  }

  return await res.json()
}

/**
 * Fetch paginated messages for a conversation
 */
export async function getMessages(conversationId, { page = 1, limit = 50 } = {}, token) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  const res = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to load messages.')
  }

  return await res.json()
}

/**
 * Send a message within a conversation
 */
export async function sendMessage(conversationId, content, token) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to send message.')
  }

  return await res.json()
}

/**
 * Mark all incoming unread messages in a conversation as read
 */
export async function markConversationAsRead(conversationId, token) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to mark conversation as read.')
  }

  return await res.json()
}

/**
 * Get total unread message count across all conversations
 */
export async function getUnreadMessageCount(token) {
  const res = await fetch(`${API_BASE_URL}/messages/unread-count`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to get unread count.')
  }

  const data = await res.json()
  return data.count || 0
}
