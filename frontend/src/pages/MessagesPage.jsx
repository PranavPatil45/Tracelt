import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { MessageSquare, ShieldCheck, ArrowRight, Package } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import ConversationList from '../components/messaging/ConversationList.jsx'
import ChatHeader from '../components/messaging/ChatHeader.jsx'
import ChatWindow from '../components/messaging/ChatWindow.jsx'
import MessageComposer from '../components/messaging/MessageComposer.jsx'
import {
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  markConversationAsRead,
} from '../api/messaging.js'
import './MessagesPage.css'

export default function MessagesPage() {
  const { user, token, loading: authLoading, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileView, setMobileView] = useState('list') // 'list' | 'chat'

  // Conversations state
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  // Active chat state
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [sending, setSending] = useState(false)

  // Auth protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  // Extract conversation_id from URL query params or route params
  const targetConvId = useRef(null)
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const qId = query.get('conversation_id') || params.conversationId
    if (qId) {
      targetConvId.current = parseInt(qId, 10)
    }
  }, [location.search, params.conversationId])

  // Load user conversations
  const loadConversationsList = useCallback(
    async (isBackground = false) => {
      if (!token) return
      if (!isBackground) setLoadingConversations(true)

      try {
        const data = await getConversations({ page: 1, limit: 50 }, token)
        const list = data.conversations || []
        setConversations(list)

        // If a target was requested or no conversation is selected yet, auto-select
        if (!selectedId) {
          if (targetConvId.current) {
            const found = list.find((c) => c.id === targetConvId.current)
            if (found) {
              setSelectedId(found.id)
              setMobileView('chat')
            } else if (list.length > 0) {
              setSelectedId(list[0].id)
            }
          } else if (list.length > 0 && window.innerWidth >= 768) {
            setSelectedId(list[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load conversations:', err)
      } finally {
        if (!isBackground) setLoadingConversations(false)
      }
    },
    [token, selectedId]
  )

  useEffect(() => {
    loadConversationsList()
  }, [loadConversationsList])

  // Load active conversation details and messages
  const loadActiveChat = useCallback(
    async (convId, isBackground = false) => {
      if (!token || !convId) return
      if (!isBackground) setLoadingChat(true)

      try {
        const [convData, msgData] = await Promise.all([
          getConversation(convId, token),
          getMessages(convId, { page: 1, limit: 100 }, token),
        ])

        setActiveConv(convData)
        setMessages(msgData.items || [])

        // If unread messages existed, mark as read
        markConversationAsRead(convId, token).catch(() => {})

        // Update unread count locally in list
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
        )
      } catch (err) {
        console.error('Failed to load chat:', err)
      } finally {
        if (!isBackground) setLoadingChat(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (selectedId) {
      loadActiveChat(selectedId)
    } else {
      setActiveConv(null)
      setMessages([])
    }
  }, [selectedId, loadActiveChat])

  // Polling for updates every 10 seconds
  useEffect(() => {
    if (!token) return

    const interval = setInterval(() => {
      loadConversationsList(true)
      if (selectedId) {
        loadActiveChat(selectedId, true)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [token, selectedId, loadConversationsList, loadActiveChat])

  // Select conversation handler
  function handleSelectConversation(id) {
    setSelectedId(id)
    setMobileView('chat')
  }

  // Back to list on mobile
  function handleBackToList() {
    setMobileView('list')
  }

  // Send message handler
  async function handleSendMessage(content) {
    if (!selectedId || !token) return
    setSending(true)

    try {
      const newMsg = await sendMessage(selectedId, content, token)
      setMessages((prev) => [...prev, newMsg])

      // Update snippet in conversations list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                last_message: newMsg,
                updated_at: newMsg.created_at,
              }
            : c
        )
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <Sidebar
        activeTab="messages"
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className="dashboard-main">
        <DashboardHeader
          user={user}
          onMenuClick={() => setMobileMenuOpen(true)}
          token={token}
        />

        <main className="dashboard-content msg-page-main">
          <div className="msg-page-container">
            {/* Left Pane: Conversation List */}
            <div
              className={`msg-page-list-col ${
                mobileView === 'chat' ? 'msg-page-list-col--hidden-mobile' : ''
              }`}
            >
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelectConversation={handleSelectConversation}
                loading={loadingConversations}
              />
            </div>

            {/* Right Pane: Active Chat Window */}
            <div
              className={`msg-page-chat-col ${
                mobileView === 'list' ? 'msg-page-chat-col--hidden-mobile' : ''
              }`}
            >
              {selectedId && activeConv ? (
                <div className="msg-chat-card">
                  <ChatHeader
                    conversation={activeConv}
                    onBack={handleBackToList}
                    showBackButton={true}
                  />

                  <ChatWindow
                    messages={messages}
                    currentUser={user}
                    loading={loadingChat}
                    isClosed={activeConv.is_closed}
                    closeReason={activeConv.close_reason}
                  />

                  <MessageComposer
                    onSendMessage={handleSendMessage}
                    sending={sending}
                    isClosed={activeConv.is_closed}
                    closeReason={activeConv.close_reason}
                  />
                </div>
              ) : (
                /* No Conversation Selected Placeholder */
                <div className="msg-no-selection-card">
                  <div className="msg-no-selection-icon">
                    <MessageSquare size={42} />
                  </div>
                  <h3 className="msg-no-selection-title">Select a Conversation</h3>
                  <p className="msg-no-selection-sub">
                    Choose a conversation from the directory on the left to coordinate handover details, safe collection locations, or status updates.
                  </p>
                  <div className="msg-no-selection-badge">
                    <ShieldCheck size={14} />
                    <span>Tracelt Verified Item Return Channel</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
