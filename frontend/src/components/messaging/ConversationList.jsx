import { useState, useMemo } from 'react'
import {
  Search,
  Package,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
} from 'lucide-react'
import { formatTimeAgo } from '../../api/notifications.js'
import { getItemImageUrl } from '../../utils/imageUrl.js'

export default function ConversationList({
  conversations = [],
  selectedId,
  onSelectConversation,
  loading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations
    const term = searchTerm.toLowerCase().trim()
    return conversations.filter((c) => {
      const titleMatch = c.item?.title?.toLowerCase().includes(term)
      const userMatch = c.other_participant?.full_name?.toLowerCase().includes(term)
      const messageMatch = c.last_message?.content?.toLowerCase().includes(term)
      return titleMatch || userMatch || messageMatch
    })
  }, [conversations, searchTerm])

  return (
    <aside className="msg-conversation-list" aria-label="Conversation Directory">
      {/* Search Header */}
      <div className="msg-list-header">
        <div className="msg-list-title-row">
          <div className="msg-list-title-wrap">
            <MessageSquare size={18} className="msg-list-icon" />
            <h2 className="msg-list-title">Conversations</h2>
          </div>
          <span className="msg-list-count">{conversations.length}</span>
        </div>

        <div className="msg-search-box">
          <Search size={15} className="msg-search-icon" />
          <input
            type="text"
            className="msg-search-input"
            placeholder="Search items or users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="msg-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Conversations Feed */}
      <div className="msg-feed-scroll">
        {loading ? (
          <div className="msg-list-skeletons">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="msg-skeleton-item">
                <div className="msg-skeleton-avatar" />
                <div className="msg-skeleton-lines">
                  <div className="msg-skeleton-line msg-skeleton-line--short" />
                  <div className="msg-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="msg-empty-list">
            <div className="msg-empty-icon-box">
              <MessageSquare size={28} />
            </div>
            <h4 className="msg-empty-title">
              {searchTerm ? 'No matching conversations' : 'No conversations yet'}
            </h4>
            <p className="msg-empty-sub">
              {searchTerm
                ? 'Try a different keyword or search query.'
                : 'Conversations with finders or claimants will appear here once a claim is submitted.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = selectedId === conv.id
            const other = conv.other_participant
            const item = conv.item
            const lastMsg = conv.last_message
            const unread = conv.unread_count || 0

            return (
              <button
                key={conv.id}
                type="button"
                className={`msg-item-card ${isSelected ? 'msg-item-card--active' : ''} ${
                  unread > 0 ? 'msg-item-card--unread' : ''
                }`}
                onClick={() => onSelectConversation(conv.id)}
              >
                {/* Thumbnail */}
                <div className="msg-item-thumb">
                  {item?.image_url ? (
                    <img
                      src={getItemImageUrl(item.image_url)}
                      alt={item.title}
                      className="msg-thumb-img"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        if (e.currentTarget.nextElementSibling) {
                          e.currentTarget.nextElementSibling.style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="msg-thumb-placeholder"
                    style={{ display: item?.image_url ? 'none' : 'flex' }}
                  >
                    <Package size={20} />
                  </div>
                  {unread > 0 && <span className="msg-unread-dot" />}
                </div>

                {/* Info Block */}
                <div className="msg-item-main">
                  <div className="msg-item-top-row">
                    <h4 className="msg-item-title" title={item?.title || 'Report'}>
                      {item?.title || 'Item Report'}
                    </h4>
                    <span className="msg-item-time">
                      {lastMsg ? formatTimeAgo(lastMsg.created_at) : formatTimeAgo(conv.created_at)}
                    </span>
                  </div>

                  <div className="msg-item-person-row">
                    <span className="msg-item-person">
                      {other?.full_name || 'User'}
                    </span>
                    <span className={`msg-role-tag msg-role-tag--${(other?.role || 'User').toLowerCase()}`}>
                      {other?.role || 'Participant'}
                    </span>
                    {conv.claim_status && (
                      <span className={`msg-status-pill msg-status-pill--${conv.claim_status.toLowerCase()}`}>
                        {conv.claim_status === 'APPROVED' && <CheckCircle2 size={10} />}
                        {conv.claim_status === 'PENDING' && <Clock size={10} />}
                        {conv.claim_status === 'REJECTED' && <XCircle size={10} />}
                        {conv.claim_status}
                      </span>
                    )}
                  </div>

                  <div className="msg-item-snippet-row">
                    <p className="msg-item-snippet">
                      {lastMsg ? (
                        <>
                          {lastMsg.is_current_user && <span className="msg-you-prefix">You: </span>}
                          {lastMsg.content}
                        </>
                      ) : (
                        <span className="msg-no-msgs">No messages yet</span>
                      )}
                    </p>
                    {unread > 0 && (
                      <span className="msg-unread-counter-badge">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
