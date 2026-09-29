import { useEffect, useRef } from 'react'
import {
  Check,
  CheckCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import { formatTimeAgo } from '../../api/notifications.js'

export default function ChatWindow({
  messages = [],
  currentUser,
  loading = false,
  isClosed = false,
  closeReason = '',
}) {
  const scrollRef = useRef(null)

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  function formatBubbleTime(dateString) {
    if (!dateString) return ''
    try {
      const d = new Date(dateString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="msg-chat-feed" ref={scrollRef}>
      {/* Closed status banner */}
      {isClosed && (
        <div className="msg-closed-banner" role="status">
          <div className="msg-closed-banner-icon">
            <CheckCircle2 size={18} />
          </div>
          <div className="msg-closed-banner-content">
            <h5 className="msg-closed-banner-title">
              Conversation Closed &bull; Read-Only Mode
            </h5>
            <p className="msg-closed-banner-text">
              {closeReason ||
                'This conversation is now closed because the item has been recovered. Previous messages remain available for your records.'}
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="msg-feed-loading">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`msg-skeleton-bubble ${
                n % 2 === 0 ? 'msg-skeleton-bubble--user' : 'msg-skeleton-bubble--other'
              }`}
            />
          ))}
        </div>
      ) : messages.length === 0 ? (
        /* Empty conversation state */
        <div className="msg-empty-chat">
          <div className="msg-empty-chat-icon">
            <MessageSquare size={32} />
          </div>
          <h4 className="msg-empty-chat-title">No messages yet</h4>
          <p className="msg-empty-chat-sub">
            Say hello and coordinate a safe public campus location to return or collect the item.
          </p>
          <div className="msg-safety-tip">
            <ShieldCheck size={14} />
            <span>Safety Tip: Always arrange meetups in well-lit campus areas like the Library or Student Center.</span>
          </div>
        </div>
      ) : (
        /* Messages Feed */
        <div className="msg-bubbles-container">
          {messages.map((m) => {
            const isUser = m.is_current_user || m.sender_id === currentUser?.id

            return (
              <div
                key={m.id}
                className={`msg-bubble-row ${
                  isUser ? 'msg-bubble-row--user' : 'msg-bubble-row--other'
                }`}
              >
                {!isUser && (
                  <div className="msg-bubble-avatar">
                    {(m.sender_name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                <div
                  className={`msg-bubble ${
                    isUser ? 'msg-bubble--user' : 'msg-bubble--other'
                  }`}
                >
                  {!isUser && (
                    <span className="msg-bubble-sender">{m.sender_name || 'User'}</span>
                  )}

                  <p className="msg-bubble-text">{m.content}</p>

                  <div className="msg-bubble-footer">
                    <span className="msg-bubble-time">{formatBubbleTime(m.created_at)}</span>
                    {isUser && (
                      <span className="msg-bubble-read-status" title={m.is_read ? 'Read' : 'Sent'}>
                        {m.is_read ? (
                          <CheckCheck size={13} className="msg-read-check msg-read-check--read" />
                        ) : (
                          <Check size={13} className="msg-read-check" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
