import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Package,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  ArrowRight,
  User,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { getConversations } from '../../../api/messaging.js'
import { formatTimeAgo } from '../../../api/notifications.js'
import './Subviews.css'

export default function MessagesView({ user }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let isMounted = true
    setLoading(true)

    getConversations({ page: 1, limit: 10 }, token)
      .then((data) => {
        if (isMounted) setConversations(data.conversations || [])
      })
      .catch((err) => {
        console.error('Failed to load subview conversations:', err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [token])

  return (
    <div className="subview-container">
      <div className="subview-header">
        <div>
          <h2 className="subview-title">Campus Communications</h2>
          <p className="subview-subtitle">
            Secure, verified item handover channels between Claimants and Finders.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/messages')}
        >
          <MessageSquare size={14} />
          <span>Open Full Messenger</span>
        </button>
      </div>

      <div className="messages-layout">
        {loading ? (
          <div className="messages-thread-card" style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>Loading active conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="messages-thread-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(6, 182, 212, 0.1)',
                color: '#06b6d4',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <MessageSquare size={28} />
            </div>
            <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '700', margin: '0 0 6px' }}>
              No conversations yet
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '13px', maxWidth: '380px', margin: '0 auto 16px' }}>
              Once you submit a claim or receive one on an item you found, you can coordinate safe returns here.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/claims')}
            >
              <ShieldCheck size={14} />
              <span>View Claims</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {conversations.map((conv) => {
              const other = conv.other_participant
              const item = conv.item
              const lastMsg = conv.last_message
              const unread = conv.unread_count || 0

              return (
                <div
                  key={conv.id}
                  className="messages-thread-card"
                  style={{ cursor: 'pointer', padding: '16px 20px', transition: 'all 0.2s ease' }}
                  onClick={() => navigate(`/messages?conversation_id=${conv.id}`)}
                >
                  <div className="messages-thread-header" style={{ marginBottom: '8px' }}>
                    <div className="thread-user-info">
                      <div className="thread-avatar">
                        {(other?.full_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="thread-title">
                          {other?.full_name || 'Campus User'} &bull;{' '}
                          <span style={{ color: '#06b6d4', fontSize: '12px' }}>
                            {other?.role}
                          </span>
                        </h4>
                        <span className="thread-verified">
                          <ShieldCheck size={12} /> {other?.campus || 'Campus'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {unread > 0 && (
                        <span
                          style={{
                            background: '#06b6d4',
                            color: '#080d1a',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                          }}
                        >
                          {unread} unread
                        </span>
                      )}
                      <span className="thread-item-tag">
                        📦 {item?.title || 'Report'}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      color: '#94a3b8',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {lastMsg ? (
                        <>
                          {lastMsg.is_current_user && (
                            <strong style={{ color: '#38bdf8' }}>You: </strong>
                          )}
                          {lastMsg.content}
                        </>
                      ) : (
                        <em>No messages yet</em>
                      )}
                    </span>

                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {lastMsg ? formatTimeAgo(lastMsg.created_at) : formatTimeAgo(conv.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
